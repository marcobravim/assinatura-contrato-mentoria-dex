// Cliente GraphQL do Autentique + validação HMAC de webhooks.
// API v2: api.autentique.com.br/v2/graphql. Mutation createDocument com
// multipart file upload (jaydenseric spec).

const ENDPOINT = 'https://api.autentique.com.br/v2/graphql'

export interface Signer {
  email?: string
  name?: string
  phone?: string
  delivery_method?: string
  action: string
}

export interface CreateDocumentInput {
  token: string
  sandbox?: boolean
  name: string
  signers: Signer[]
  pdfBytes: Uint8Array
  filename: string
  reminder?: string
}

export interface CreateDocumentResult {
  id: string
  signatures: Array<{
    public_id: string
    email: string | null
    link: { short_link: string } | null
  }>
}

export async function createDocument(input: CreateDocumentInput): Promise<CreateDocumentResult> {
  const query = `mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) { createDocument(sandbox: ${input.sandbox ? 'true' : 'false'}, document: $document, signers: $signers, file: $file) { id signatures { public_id email link { short_link } } } }`
  const variables = { document: { name: input.name, reminder: input.reminder ?? 'WEEKLY', refusable: true }, signers: input.signers, file: null }
  const form = new FormData()
  form.append('operations', JSON.stringify({ query, variables }))
  form.append('map', JSON.stringify({ '0': ['variables.file'] }))
  form.append('0', new Blob([input.pdfBytes], { type: 'application/pdf' }), input.filename)
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${input.token}` }, body: form })
  const text = await res.text()
  let json: unknown
  try { json = JSON.parse(text) } catch { throw new Error(`Autentique returned non-JSON (${res.status}): ${text.slice(0, 500)}`) }
  if (!res.ok) throw new Error(`Autentique ${res.status}: ${text}`)
  const payload = json as { data?: { createDocument: CreateDocumentResult }; errors?: Array<{ message: string }> }
  if (payload.errors?.length) throw new Error(`Autentique errors: ${payload.errors.map((e) => e.message).join('; ')}`)
  if (!payload.data?.createDocument) throw new Error('Autentique response missing data.createDocument')
  return payload.data.createDocument
}

// Valida HMAC-SHA256 do header x-autentique-signature contra o raw body
// usando o secret compartilhado. Timing-safe para evitar ataques de timing.
export async function validateWebhookSignature(rawBody: string, signatureHex: string, secret: string): Promise<boolean> {
  if (!signatureHex) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')
  const b = signatureHex.toLowerCase()
  if (expected.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
