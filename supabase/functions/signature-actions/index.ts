import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsPreflight, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const AUTENTIQUE_TOKEN = Deno.env.get('AUTENTIQUE_TOKEN')!

// Ações pós-criação no Autentique: reenviar e-mail de assinatura
// ou gerar um novo short_link para o signatário mentorado.
//
// Body: { contract_id: string, action: 'resend' | 'generate-link' }
// Retorna:
//   resend: { ok: true }
//   generate-link: { ok: true, link: string }
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

    const { contract_id, action } = await req.json() as { contract_id?: string; action?: 'resend' | 'generate-link' }
    if (!contract_id) return jsonResponse({ error: 'contract_id obrigatório' }, 400)
    if (action !== 'resend' && action !== 'generate-link') return jsonResponse({ error: 'action deve ser resend ou generate-link' }, 400)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: contract, error: getErr } = await admin
      .from('contracts')
      .select('id, created_by, autentique_document_id, client_data')
      .eq('id', contract_id)
      .maybeSingle()
    if (getErr) return jsonResponse({ error: `DB read failed: ${getErr.message}` }, 500)
    if (!contract) return jsonResponse({ error: 'Contrato não encontrado' }, 404)
    if (contract.created_by !== user.id) return jsonResponse({ error: 'Sem permissão' }, 403)
    if (!contract.autentique_document_id) return jsonResponse({ error: 'Contrato sem documento Autentique' }, 400)

    // 1. Busca o public_id do mentorado (signer cujo email bate com participante.email)
    const mentoradoEmail = (contract.client_data as { participante?: { email?: string } })?.participante?.email
    if (!mentoradoEmail) return jsonResponse({ error: 'Email do participante não encontrado no contrato' }, 400)

    const sigsRes = await fetchAutentique(`query($id: UUID!) { document(id: $id) { signatures { public_id email signed { created_at } } } }`, { id: contract.autentique_document_id })
    const sigs = sigsRes?.data?.document?.signatures as Array<{ public_id: string; email: string | null; signed: unknown }> | undefined
    const mentoradoSig = sigs?.find((s) => s.email === mentoradoEmail)
    if (!mentoradoSig) return jsonResponse({ error: 'Signatário do mentorado não encontrado no documento' }, 404)
    if (mentoradoSig.signed) return jsonResponse({ error: 'Mentorado já assinou o contrato' }, 400)

    if (action === 'resend') {
      const r = await fetchAutentique(`mutation($ids: [UUID!]!) { resendSignatures(public_ids: $ids) }`, { ids: [mentoradoSig.public_id] })
      if (r?.errors?.length) return jsonResponse({ error: `Autentique: ${r.errors.map((e: { message: string }) => e.message).join('; ')}` }, 500)
      return jsonResponse({ ok: true })
    }

    // generate-link
    const r = await fetchAutentique(`mutation($pid: UUID!) { createLinkToSignature(public_id: $pid) { short_link } }`, { pid: mentoradoSig.public_id })
    if (r?.errors?.length) return jsonResponse({ error: `Autentique: ${r.errors.map((e: { message: string }) => e.message).join('; ')}` }, 500)
    const link = r?.data?.createLinkToSignature?.short_link as string | undefined
    if (!link) return jsonResponse({ error: 'Autentique não retornou link' }, 500)

    // Atualiza o link no DB pra os botões de copiar/abrir refletirem o novo.
    await admin.from('contracts').update({ autentique_short_link: link }).eq('id', contract_id)

    return jsonResponse({ ok: true, link })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

async function fetchAutentique(query: string, variables: Record<string, unknown>) {
  const res = await fetch('https://api.autentique.com.br/v2/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${AUTENTIQUE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  return await res.json().catch(() => null)
}
