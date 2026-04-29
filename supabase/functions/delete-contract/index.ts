import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsPreflight, jsonResponse } from '../_shared/cors.ts'
import { getDriveAccessToken, loadServiceAccount } from '../_shared/google-drive.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const AUTENTIQUE_TOKEN = Deno.env.get('AUTENTIQUE_TOKEN')

// Apaga um contrato em todos os lugares onde ele existe:
// 1. Drive (PDF assinado, vai pra lixeira — recuperável 30 dias)
// 2. Autentique (deleteDocument; best-effort, pode falhar se doc estiver finalizado)
// 3. Supabase Storage (PDF backup do bucket 'generated')
// 4. Supabase DB (row de contracts)
//
// Auth via getUser; só apaga se o user logado for o created_by da row.
Deno.serve(async (req) => {
  const pre = corsPreflight(req)
  if (pre) return pre

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return jsonResponse({ error: 'Missing Bearer token' }, 401)

    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: userRes, error: uErr } = await userClient.auth.getUser()
    const user = userRes?.user
    if (uErr || !user) return jsonResponse({ error: `Não autorizado: ${uErr?.message ?? 'no user'}` }, 401)

    const { contract_id } = await req.json() as { contract_id?: string }
    if (!contract_id) return jsonResponse({ error: 'contract_id obrigatório' }, 400)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: contract, error: getErr } = await admin
      .from('contracts')
      .select('id, created_by, autentique_document_id, signed_pdf_drive_id, generated_pdf_path')
      .eq('id', contract_id)
      .maybeSingle()
    if (getErr) return jsonResponse({ error: `DB read failed: ${getErr.message}` }, 500)
    if (!contract) return jsonResponse({ error: 'Contrato não encontrado' }, 404)
    if (contract.created_by !== user.id) return jsonResponse({ error: 'Sem permissão' }, 403)

    const cleanup: Record<string, string> = {}

    // 1. Trash do PDF assinado no Drive
    if (contract.signed_pdf_drive_id) {
      try {
        const sa = loadServiceAccount()
        const token = await getDriveAccessToken(sa, ['https://www.googleapis.com/auth/drive'])
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${contract.signed_pdf_drive_id}?supportsAllDrives=true`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: true }),
        })
        cleanup.drive = r.ok ? 'trashed' : `failed_${r.status}`
      } catch (e) { cleanup.drive = `error_${e instanceof Error ? e.message : 'unknown'}` }
    } else { cleanup.drive = 'skip' }

    // 2. Autentique: deleteDocument (best-effort)
    if (contract.autentique_document_id && AUTENTIQUE_TOKEN) {
      try {
        const r = await fetch('https://api.autentique.com.br/v2/graphql', {
          method: 'POST',
          headers: { Authorization: `Bearer ${AUTENTIQUE_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'mutation($id: UUID!) { deleteDocument(id: $id) }',
            variables: { id: contract.autentique_document_id },
          }),
        })
        const j = await r.json().catch(() => ({}))
        cleanup.autentique = j.errors?.length ? `errors_${j.errors[0].message}` : 'deleted'
      } catch (e) { cleanup.autentique = `error_${e instanceof Error ? e.message : 'unknown'}` }
    } else { cleanup.autentique = 'skip' }

    // 3. Storage backup
    if (contract.generated_pdf_path) {
      const r = await admin.storage.from('generated').remove([contract.generated_pdf_path])
      cleanup.storage = r.error ? `failed_${r.error.message}` : 'deleted'
    } else { cleanup.storage = 'skip' }

    // 4. DB row (último — se anterior falhou, ainda é possível retomar via re-execução)
    const { error: delErr } = await admin.from('contracts').delete().eq('id', contract_id)
    if (delErr) return jsonResponse({ error: `DB delete failed: ${delErr.message}`, cleanup }, 500)
    cleanup.db = 'deleted'

    return jsonResponse({ ok: true, cleanup })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
