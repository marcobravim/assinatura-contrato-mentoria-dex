// Google Drive helper: service account JWT -> access token -> upload/export/delete.
// The service account must be given access to the target folder (share the folder
// with the SA email as "Editor"). For DOCX->PDF conversion we exploit Drive's
// native conversion by uploading the DOCX with mimeType=application/vnd.google-apps.document
// and then exporting it as application/pdf.

import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

interface ServiceAccountJson {
  client_email: string
  private_key: string
  token_uri?: string
}

async function importPrivateKey(pem: string) {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const bin = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    bin,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getDriveAccessToken(sa: ServiceAccountJson, scopes: string[]): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token

  const key = await importPrivateKey(sa.private_key)
  const now = getNumericDate(0)
  const jwt = await create(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: sa.client_email,
      scope: scopes.join(' '),
      aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
      exp: getNumericDate(3600),
      iat: now,
    },
    key,
  )

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Drive token error: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return data.access_token
}

export function loadServiceAccount(): ServiceAccountJson {
  const raw = Deno.env.get('GOOGLE_SA_JSON')
  if (!raw) throw new Error('GOOGLE_SA_JSON env var is required')
  return JSON.parse(raw) as ServiceAccountJson
}

// Converts DOCX -> PDF via Drive: upload as gdoc, export, delete intermediate.
export async function docxToPdf(docxBytes: Uint8Array, token: string, filename: string): Promise<Uint8Array> {
  const metadata = { name: filename, mimeType: 'application/vnd.google-apps.document' }
  const boundary = `bnd${crypto.randomUUID()}`
  const body = buildMultipart(boundary, metadata, docxBytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

  const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  if (!up.ok) throw new Error(`Drive upload failed: ${up.status} ${await up.text()}`)
  const { id } = (await up.json()) as { id: string }

  try {
    const exp = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=application/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!exp.ok) throw new Error(`Drive export failed: ${exp.status} ${await exp.text()}`)
    return new Uint8Array(await exp.arrayBuffer())
  } finally {
    // Service Accounts em Shared Drive não têm permissão de hard-delete
    // (mesmo como Content Manager); mover pra lixeira é equivalente e recuperável.
    await fetch(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
  }
}

// Upload a finished PDF to a specific folder in Drive.
export async function uploadPdfToFolder(
  pdfBytes: Uint8Array,
  token: string,
  filename: string,
  folderId: string,
): Promise<string> {
  const metadata = { name: filename, mimeType: 'application/pdf', parents: [folderId] }
  const boundary = `bnd${crypto.randomUUID()}`
  const body = buildMultipart(boundary, metadata, pdfBytes, 'application/pdf')

  const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  if (!up.ok) throw new Error(`Drive upload failed: ${up.status} ${await up.text()}`)
  const { id } = (await up.json()) as { id: string }
  return id
}

function buildMultipart(
  boundary: string,
  metadata: Record<string, unknown>,
  fileBytes: Uint8Array,
  fileMime: string,
): Uint8Array {
  const enc = new TextEncoder()
  const head = enc.encode(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${fileMime}\r\n\r\n`,
  )
  const tail = enc.encode(`\r\n--${boundary}--`)
  const out = new Uint8Array(head.length + fileBytes.length + tail.length)
  out.set(head, 0)
  out.set(fileBytes, head.length)
  out.set(tail, head.length + fileBytes.length)
  return out
}
