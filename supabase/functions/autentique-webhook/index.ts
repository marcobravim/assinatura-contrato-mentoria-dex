import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { validateWebhookSignature } from '../_shared/autentique.ts'
import { getDriveAccessToken, loadServiceAccount, uploadPdfToFolder } from '../_shared/google-drive.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('AUTENTIQUE_WEBHOOK_SECRET') // opcional (feature Pro do Autentique)
const AUTENTIQUE_TOKEN = Deno.env.get('AUTENTIQUE_TOKEN')!
const DRIVE_FOLDER_ID = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID')

interface AutentiqueEvent {
  event?: {
    type?: string
    data?: { object?: { id?: string; name?: string } }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const raw = await req.text()
  const sig = req.headers.get('x-autentique-signature') ?? ''

  // Se o segredo foi configurado e o Autentique enviou assinatura (plano Pro),
  // validamos. Se o secret está presente mas a request veio sem header, aceita
  // (conta sem Pro) — segurança real vem do re-check via API no próximo passo.
  if (WEBHOOK_SECRET && sig) {
    const valid = await validateWebhookSignature(raw, sig, WEBHOOK_SECRET)
    if (!valid) return new Response('invalid signature', { status: 401 })
  }

  let payload: AutentiqueEvent
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  // Responde rápido e processa em background.
  queueMicrotask(() => processEvent(payload).catch((e) => console.error('webhook error', e)))
  return new Response('ok', { status: 200 })
})

async function processEvent(payload: AutentiqueEvent) {
  const docId = payload.event?.data?.object?.id
  const evtType = payload.event?.type ?? ''
  if (!docId) {
    console.warn('webhook sem doc id')
    return
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Atualizações leves (viewed/rejected) só mexem em status — não precisam revalidar PDF
  if (evtType === 'signature.viewed' || evtType === 'signature.rejected') {
    const status = evtType === 'signature.viewed' ? 'viewed' : 'rejected'
    await admin.from('contracts').update({ status }).eq('autentique_document_id', docId)
    return
  }

  // Para document.finished (ou qualquer evento que finalize), revalidamos via
  // API Autentique direto — fonte de verdade. Evita confiar cegamente no body.
  const fresh = await queryAutentiqueDocument(docId)
  if (!fresh) {
    console.warn('doc não encontrado no Autentique:', docId)
    return
  }

  const allSigned =
    fresh.signatures.length > 0 &&
    fresh.signatures.every((s) => s.signed || s.action?.name === 'ACKNOWLEDGE_RECEIPT')
  const hasSignedUrl = !!fresh.files?.signed

  if (!allSigned || !hasSignedUrl) {
    console.log(`doc ${docId}: ainda pendente (allSigned=${allSigned}, signedUrl=${hasSignedUrl})`)
    return
  }

  // Carrega contrato local
  const { data: contract } = await admin
    .from('contracts')
    .select('id, status, signed_pdf_drive_id')
    .eq('autentique_document_id', docId)
    .maybeSingle()
  if (!contract) {
    console.warn('contrato não encontrado no DB:', docId)
    return
  }
  if (contract.signed_pdf_drive_id) {
    console.log('já arquivado, ignorando:', contract.id)
    return
  }

  if (!DRIVE_FOLDER_ID) {
    console.error('GOOGLE_DRIVE_FOLDER_ID não configurado — não arquiva')
    return
  }

  // Baixa o PDF assinado do Autentique (URL fornecida pela API)
  const pdfRes = await fetch(fresh.files.signed, {
    headers: { Authorization: `Bearer ${AUTENTIQUE_TOKEN}` },
  })
  if (!pdfRes.ok) {
    console.error('falha ao baixar PDF assinado:', pdfRes.status, await pdfRes.text())
    return
  }
  const bytes = new Uint8Array(await pdfRes.arrayBuffer())

  const sa = loadServiceAccount()
  const driveToken = await getDriveAccessToken(sa, ['https://www.googleapis.com/auth/drive'])
  const driveId = await uploadPdfToFolder(bytes, driveToken, `${fresh.name}.pdf`, DRIVE_FOLDER_ID)

  await admin
    .from('contracts')
    .update({
      status: 'archived',
      signed_at: new Date().toISOString(),
      archived_at: new Date().toISOString(),
      signed_pdf_drive_id: driveId,
    })
    .eq('id', contract.id)

  console.log(`arquivado: ${contract.id} → Drive ${driveId}`)
}

async function queryAutentiqueDocument(docId: string) {
  const query = `query($id: UUID!) { document(id: $id) { id name files { signed } signatures { signed { created_at } action { name } } } }`
  const res = await fetch('https://api.autentique.com.br/v2/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${AUTENTIQUE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: docId } }),
  })
  if (!res.ok) {
    console.error('autentique query falhou:', res.status, await res.text())
    return null
  }
  const json = (await res.json()) as {
    data?: {
      document?: {
        id: string
        name: string
        files: { signed: string | null }
        signatures: Array<{ signed: { created_at: string } | null; action: { name: string } | null }>
      }
    }
    errors?: Array<{ message: string }>
  }
  if (json.errors?.length) {
    console.error('autentique errors:', json.errors.map((e) => e.message).join('; '))
    return null
  }
  return json.data?.document ?? null
}
