import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsPreflight, jsonResponse } from '../_shared/cors.ts'
import { renderDocx } from '../_shared/docx.ts'
import { docxToPdf, getDriveAccessToken, loadServiceAccount } from '../_shared/google-drive.ts'
import { createDocument, signDocumentAsOwner } from '../_shared/autentique.ts'
import { buildTemplateData, type ClientData } from '../_shared/template-data.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const AUTENTIQUE_TOKEN = Deno.env.get('AUTENTIQUE_TOKEN')
const AUTENTIQUE_SANDBOX = Deno.env.get('AUTENTIQUE_SANDBOX') !== 'false'

// verify_jwt=false no gate; validação do usuário é feita via getUser() abaixo,
// que usa o Auth service (ES256-compat).
Deno.serve(async (req) => {
  const pre = corsPreflight(req)
  if (pre) return pre

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return jsonResponse({ error: 'Missing Bearer token' }, 401)

    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error: uErr } = await userClient.auth.getUser()
    const user = userRes?.user
    if (uErr || !user) return jsonResponse({ error: `Não autorizado: ${uErr?.message ?? 'no user'}` }, 401)

    const body = (await req.json()) as ClientData
    if (!body?.participante?.nome || !body?.participante?.email || !body?.pagamento) {
      return jsonResponse({ error: 'Payload inválido' }, 400)
    }
    if (!AUTENTIQUE_TOKEN) return jsonResponse({ error: 'AUTENTIQUE_TOKEN não configurado no servidor' }, 500)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: templateFile, error: dlErr } = await admin.storage
      .from('templates')
      .download('contrato-modelo.docx')
    if (dlErr || !templateFile) {
      return jsonResponse({ error: 'Template contrato-modelo.docx não encontrado no bucket templates' }, 500)
    }

    const docxBytes = renderDocx(
      await templateFile.arrayBuffer(),
      buildTemplateData(body, { comercial_email: user.email ?? '' }),
    )

    const sa = loadServiceAccount()
    const token = await getDriveAccessToken(sa, ['https://www.googleapis.com/auth/drive'])
    const pdfBytes = await docxToPdf(docxBytes, token, `Mentoria DEX - ${body.participante.nome}`)

    const { data: inserted, error: insErr } = await admin
      .from('contracts')
      .insert({ created_by: user.id, client_data: body, status: 'draft' })
      .select()
      .single()
    if (insErr || !inserted) return jsonResponse({ error: `Falha ao criar registro: ${insErr?.message}` }, 500)

    const pdfPath = `${inserted.id}.pdf`
    const up = await admin.storage
      .from('generated')
      .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true })
    if (up.error) console.error('generated upload failed', up.error)

    const result = await createDocument({
      token: AUTENTIQUE_TOKEN,
      sandbox: AUTENTIQUE_SANDBOX,
      name: `Mentoria DEX - ${body.participante.nome}`,
      signers: [{ email: body.participante.email, action: 'SIGN', name: body.participante.nome }],
      pdfBytes,
      filename: `contrato-${inserted.id}.pdf`,
    })

    // Auto-assina como dono do token (Cris Miura). Em sandbox falha silenciosamente;
    // em produção a signature do dono é criada pelo Autentique automaticamente e
    // esta chamada já deixa a assinatura dela concluída — resta só o mentorado.
    await signDocumentAsOwner(AUTENTIQUE_TOKEN, result.id)

    const { error: updErr } = await admin
      .from('contracts')
      .update({
        status: 'sent',
        autentique_document_id: result.id,
        autentique_short_link: result.signatures[0]?.link?.short_link ?? null,
        generated_pdf_path: up.error ? null : pdfPath,
      })
      .eq('id', inserted.id)
    if (updErr) console.error('update after autentique failed', updErr)

    return jsonResponse({
      contract_id: inserted.id,
      autentique_document_id: result.id,
      short_link: result.signatures[0]?.link?.short_link ?? null,
    })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : String(err)
    return jsonResponse({ error: message }, 500)
  }
})
