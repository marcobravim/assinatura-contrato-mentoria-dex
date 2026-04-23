// Autentique GraphQL client with multipart file upload support.
// Spec: https://github.com/jaydenseric/graphql-multipart-request-spec

const ENDPOINT = 'https://api.autentique.com.br/v2/graphql'

export interface Signer {
  email?: string
  name?: string
  phone?: string
  delivery_method?: 'DELIVERY_METHOD_EMAIL' | 'DELIVERY_METHOD_WHATSAPP'
  action: 'SIGN' | 'WITNESS' | 'APPROVE' | 'ACKNOWLEDGE'
}

export interface CreateDocumentInput {
  token: string
  sandbox?: boolean
  name: string
  signers: Signer[]
  pdfBytes: Uint8Array
  filename: string
  reminder?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
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
  const query = `
    mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(
        sandbox: ${input.sandbox ? 'true' : 'false'}
        document: $document
        signers: $signers
        file: $file
      ) {
        id
        signatures {
          public_id
          email
          link { short_link }
        }
      }
    }
  `.trim()

  const variables = {
    document: {
      name: input.name,
      reminder: input.reminder ?? 'WEEKLY',
      refusable: true,
    },
    signers: input.signers,
    file: null,
  }

  const form = new FormData()
  form.append('operations', JSON.stringify({ query, variables }))
  form.append('map', JSON.stringify({ '0': ['variables.file'] }))
  form.append('0', new Blob([input.pdfBytes], { type: 'application/pdf' }), input.filename)

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.token}` },
    body: form,
  })

  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Autentique returned non-JSON (${res.status}): ${text.slice(0, 500)}`)
  }
  if (!res.ok) throw new Error(`Autentique ${res.status}: ${text}`)
  const payload = json as { data?: { createDocument: CreateDocumentResult }; errors?: Array<{ message: string }> }
  if (payload.errors?.length) throw new Error(`Autentique errors: ${payload.errors.map((e) => e.message).join('; ')}`)
  if (!payload.data?.createDocument) throw new Error('Autentique response missing data.createDocument')
  return payload.data.createDocument
}

// HMAC-SHA256 validation for webhook payloads.
// Autentique signs the raw request body with the configured webhook secret
// and sends it as header `x-autentique-signature` (hex digest).
// signDocument assina o documento como a conta dona do token (auto-sign).
// Em sandbox retorna signature_not_found — engolimos e seguimos; em produção
// a conta dona é adicionada automaticamente como signatária e pode assinar.
export async function signDocumentAsOwner(token: string, documentId: string): Promise<boolean> {
  const query = `mutation SignAsOwner($id: UUID!) { signDocument(id: $id) }`
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: documentId } }),
  })
  const text = await res.text()
  try {
    const json = JSON.parse(text) as { data?: { signDocument: boolean | null }; errors?: Array<{ message: string }> }
    if (json.errors?.length) {
      console.warn(`signDocumentAsOwner skipped: ${json.errors.map((e) => e.message).join('; ')}`)
      return false
    }
    return json.data?.signDocument === true
  } catch {
    console.warn(`signDocumentAsOwner non-JSON response: ${text.slice(0, 200)}`)
    return false
  }
}

export async function validateWebhookSignature(rawBody: string, signatureHex: string, secret: string): Promise<boolean> {
  if (!signatureHex) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected = toHex(new Uint8Array(mac))
  return timingSafeEqual(expected, signatureHex.toLowerCase())
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
