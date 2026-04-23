// Google Drive helper: service account JWT → access token → upload / export / trash.
// Usa a SA app-assinatura-contrato como Content Manager do Shared Drive.
// Shared Drive não permite hard-delete do SA, então usamos PATCH {trashed: true}
// pra "apagar" intermediários (recuperável por 30 dias na lixeira do Drive).

import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

interface ServiceAccountJson {
  client_email: string
  private_key: string
  token_uri?: string
}

async function importPrivateKey(pem: string) {
  const cleaned = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  const bin = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', bin, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getDriveAccessToken(sa: ServiceAccountJson, scopes: string[]): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token
  const key = await importPrivateKey(sa.private_key)
  const jwt = await create({ alg: 'RS256', typ: 'JWT' }, { iss: sa.client_email, scope: scopes.join(' '), aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token', exp: getNumericDate(3600), iat: getNumericDate(0) }, key)
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })
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

// Converte DOCX → PDF via Drive: upload como Google Doc (convert automático),
// export como PDF, trash do intermediário. O gdoc é criado direto na pasta
// de destino pra SA ter permissão de trash (no Shared Drive).
export async function docxToPdf(docxBytes: Uint8Array, token: string, filename: string): Promise<Uint8Array> {
  const folderId = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID')
  const metadata: Record<string, unknown> = { name: filename, mimeType: 'application/vnd.google-apps.document' }
  if (folderId) metadata.parents = [folderId]
  const boundary = `bnd${crypto.randomUUID()}`
  const enc = new TextEncoder()
  const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n`)
  const tail = enc.encode(`\r\n--${boundary}--`)
  const body = new Uint8Array(head.length + docxBytes.length + tail.length)
  body.set(head, 0); body.set(docxBytes, head.length); body.set(tail, head.length + docxBytes.length)
  const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body })
  if (!up.ok) throw new Error(`Drive upload failed: ${up.status} ${await up.text()}`)
  const { id } = (await up.json()) as { id: string }
  try {
    const exp = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=application/pdf`, { headers: { Authorization: `Bearer ${token}` } })
    if (!exp.ok) throw new Error(`Drive export failed: ${exp.status} ${await exp.text()}`)
    return new Uint8Array(await exp.arrayBuffer())
  } finally {
    // Service Account em Shared Drive não tem hard-delete; trashing é recuperável 30 dias.
    await fetch(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) })
  }
}

// Upload de um PDF já pronto numa pasta específica do Drive (destino final).
export async function uploadPdfToFolder(pdfBytes: Uint8Array, token: string, filename: string, folderId: string): Promise<string> {
  const metadata = { name: filename, mimeType: 'application/pdf', parents: [folderId] }
  const boundary = `bnd${crypto.randomUUID()}`
  const enc = new TextEncoder()
  const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`)
  const tail = enc.encode(`\r\n--${boundary}--`)
  const body = new Uint8Array(head.length + pdfBytes.length + tail.length)
  body.set(head, 0); body.set(pdfBytes, head.length); body.set(tail, head.length + pdfBytes.length)
  const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body })
  if (!up.ok) throw new Error(`Drive upload failed: ${up.status} ${await up.text()}`)
  const { id } = (await up.json()) as { id: string }
  return id
}
