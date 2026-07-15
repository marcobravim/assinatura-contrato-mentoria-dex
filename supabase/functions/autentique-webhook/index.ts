import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { validateWebhookSignature } from '../_shared/autentique.ts'
import { getDriveAccessToken, loadServiceAccount, uploadPdfToFolder } from '../_shared/google-drive.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// AUTENTIQUE_WEBHOOK_SECRET aceita múltiplos secrets separados por vírgula.
// Autentique gera um secret por endpoint, então guardamos todos e validamos
// contra qualquer um que bater.
const WEBHOOK_SECRETS = (Deno.env.get('AUTENTIQUE_WEBHOOK_SECRET') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const AUTENTIQUE_TOKEN = Deno.env.get('AUTENTIQUE_TOKEN')!
const DRIVE_FOLDER_ID = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID')
const OWNER_SIGNER_EMAIL = Deno.env.get('OWNER_SIGNER_EMAIL') ?? ''

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const raw = await req.text()
  const sig = req.headers.get('x-autentique-signature') ?? ''

  if (WEBHOOK_SECRETS.length > 0 && sig) {
    let valid = false
    for (const secret of WEBHOOK_SECRETS) {
      if (await validateWebhookSignature(raw, sig, secret)) { valid = true; break }
    }
    if (!valid) { await logDebug(sig, raw, null, null, null, 'HMAC_INVALID'); return new Response('invalid signature', { status: 401 }) }
  }

  let payload: Record<string, unknown> | null = null
  try { payload = JSON.parse(raw) } catch { await logDebug(sig, raw, null, null, null, 'JSON_PARSE_FAIL'); return new Response('invalid json', { status: 400 }) }

  const docId = extractDocId(payload)
  const evtType = extractEventType(payload)
  await logDebug(sig, raw, payload, docId, evtType, 'RECEIVED')

  queueMicrotask(() => processEvent(docId, evtType).catch((e) => console.error('webhook error', e)))
  return new Response('ok', { status: 200 })
})

function extractDocId(p: Record<string, unknown>): string | null {
  // event.data.id é o path real do Autentique (não event.data.object.id como a doc sugere).
  // Também ignoramos IDs do endpoint do webhook (base64 com '=' ou '|').
  const paths: Array<string[]> = [['event', 'data', 'id'], ['event', 'data', 'object', 'id'], ['data', 'id'], ['data', 'object', 'id'], ['document', 'id']]
  for (const path of paths) {
    let v: unknown = p
    for (const k of path) { if (v && typeof v === 'object' && k in v) v = (v as Record<string, unknown>)[k]; else { v = null; break } }
    if (typeof v === 'string' && v.length >= 40 && !v.includes('=') && !v.includes('|')) return v
  }
  return null
}

function extractEventType(p: Record<string, unknown>): string {
  const e = (p.event as Record<string, unknown> | undefined)?.type
  if (typeof e === 'string') return e
  if (typeof p.type === 'string') return p.type
  return ''
}

async function logDebug(sig: string, raw: string, parsed: unknown, docId: string | null, evtType: string | null, result: string) {
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin.from('webhook_debug').insert({ signature_header: sig || null, raw_body: raw.slice(0, 5000), parsed, extracted_doc_id: docId, extracted_event_type: evtType || null, result })
  } catch (e) { console.error('debug log failed', e) }
}

function sanitizeFilename(s: string): string {
  return s.replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

// en-CA formata datas como YYYY-MM-DD. Usamos com timeZone America/Sao_Paulo
// pra que o nome do arquivo reflita a data de Brasília, não UTC.
function brasiliaDateISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function buildDriveFilename(mentoradoNome: string): string {
  const nome = sanitizeFilename(mentoradoNome || 'Mentorado')
  return `${brasiliaDateISO()} - Contrato DSD - ${nome} [assinado].pdf`
}

async function processEvent(docId: string | null, evtType: string) {
  if (!docId) { await logDebug('', '', null, null, evtType, 'NO_DOC_ID'); return }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  if (evtType === 'signature.viewed') {
    await admin.from('contracts').update({ status: 'viewed' }).eq('autentique_document_id', docId)
    await logDebug('', '', null, docId, evtType, 'STATUS_VIEWED')
    return
  }
  if (evtType === 'signature.rejected') {
    await admin.from('contracts').update({ status: 'rejected' }).eq('autentique_document_id', docId)
    await logDebug('', '', null, docId, evtType, 'STATUS_REJECTED')
    return
  }

  const fresh = await queryAutentiqueDocument(docId)
  if (!fresh) { await logDebug('', '', null, docId, evtType, 'DOC_NOT_FOUND_AUTENTIQUE'); return }

  const signers = fresh.signatures.filter((s) => s.action?.name === 'SIGN')
  const signedSigners = signers.filter((s) => !!s.signed)
  const signedCount = signedSigners.length
  const totalSigners = signers.length
  const allSigned = totalSigners > 0 && signedCount === totalSigners
  const hasSignedUrl = !!fresh.files?.signed

  const { data: contract } = await admin.from('contracts').select('id, status, signed_pdf_drive_id, client_data, archived_at').eq('autentique_document_id', docId).maybeSingle()
  if (!contract) { await logDebug('', '', null, docId, evtType, 'CONTRACT_NOT_IN_DB'); return }
  if (contract.signed_pdf_drive_id) { await logDebug('', '', null, docId, evtType, 'ALREADY_ARCHIVED'); return }

  if (!allSigned) {
    if (signedCount === 0) { await logDebug('', '', null, docId, evtType, `NO_SIGNATURES_YET (${signedCount}/${totalSigners})`); return }
    const mentoradoAssinou = signedSigners.some((s) => s.email !== OWNER_SIGNER_EMAIL)
    const newStatus = mentoradoAssinou ? 'signed' : 'sent'
    await admin.from('contracts').update({ status: newStatus, signed_at: mentoradoAssinou ? new Date().toISOString() : null }).eq('id', contract.id)
    await logDebug('', '', null, docId, evtType, `STATUS_${newStatus.toUpperCase()} mentorado=${mentoradoAssinou} (${signedCount}/${totalSigners})`)
    return
  }

  if (!hasSignedUrl) { await logDebug('', '', null, docId, evtType, 'ALL_SIGNED_BUT_NO_PDF_YET'); return }
  if (!DRIVE_FOLDER_ID) { await logDebug('', '', null, docId, evtType, 'NO_FOLDER_ID'); return }

  // CLAIM ATÔMICO: setamos archived_at=now() só se archived_at AINDA for NULL
  // E signed_pdf_drive_id também for NULL. Se a query afeta 0 linhas, outra
  // invocação já está arquivando e a gente aborta sem duplicar. Previne
  // race condition quando webhooks 'document.finished' e 'signature.accepted'
  // chegam quase simultaneamente na finalização do doc.
  const archivingAt = new Date().toISOString()
  const { data: claimed, error: claimErr } = await admin
    .from('contracts')
    .update({ archived_at: archivingAt })
    .eq('id', contract.id)
    .is('archived_at', null)
    .is('signed_pdf_drive_id', null)
    .select('id')
    .maybeSingle()
  if (claimErr || !claimed) { await logDebug('', '', null, docId, evtType, `CLAIM_LOST ${claimErr?.message ?? 'other worker'}`); return }

  try {
    const pdfRes = await fetch(fresh.files.signed!, { headers: { Authorization: `Bearer ${AUTENTIQUE_TOKEN}` } })
    if (!pdfRes.ok) throw new Error(`PDF_FETCH_${pdfRes.status}`)
    const bytes = new Uint8Array(await pdfRes.arrayBuffer())

    const mentoradoNome = (contract.client_data as { participante?: { nome?: string } })?.participante?.nome ?? ''
    const filename = buildDriveFilename(mentoradoNome)

    const sa = loadServiceAccount()
    const driveToken = await getDriveAccessToken(sa, ['https://www.googleapis.com/auth/drive'])
    const driveId = await uploadPdfToFolder(bytes, driveToken, filename, DRIVE_FOLDER_ID)

    await admin.from('contracts').update({ status: 'archived', signed_at: new Date().toISOString(), signed_pdf_drive_id: driveId }).eq('id', contract.id)
    await logDebug('', '', null, docId, evtType, `ARCHIVED drive=${driveId} name='${filename}'`)
  } catch (e) {
    // Rollback do claim pra próxima invocação tentar de novo
    await admin.from('contracts').update({ archived_at: null }).eq('id', contract.id).is('signed_pdf_drive_id', null)
    await logDebug('', '', null, docId, evtType, `ARCHIVE_FAIL ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function queryAutentiqueDocument(docId: string) {
  const query = `query($id: UUID!) { document(id: $id) { id name files { signed } signatures { email signed { created_at } action { name } } } }`
  const res = await fetch('https://api.autentique.com.br/v2/graphql', { method: 'POST', headers: { Authorization: `Bearer ${AUTENTIQUE_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { id: docId } }) })
  if (!res.ok) return null
  const json = (await res.json()) as { data?: { document?: { id: string; name: string; files: { signed: string | null }; signatures: Array<{ email: string | null; signed: { created_at: string } | null; action: { name: string } | null }> } }; errors?: Array<{ message: string }> }
  if (json.errors?.length) return null
  return json.data?.document ?? null
}
