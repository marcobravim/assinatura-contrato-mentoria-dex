// Valida: (1) SA JSON autentica na Google; (2) SA consegue listar/escrever
// na pasta do Drive. Se der erro, ajustar antes de subir secrets.

import { google } from 'googleapis'
import fs from 'node:fs'

const SA_PATH = process.argv[2]
const FOLDER_ID = process.argv[3]

if (!SA_PATH || !FOLDER_ID) {
  console.error('usage: node test-drive.mjs <sa-json-path> <folder-id>')
  process.exit(1)
}

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf-8'))

const auth = new google.auth.JWT({
  email: sa.client_email,
  key: sa.private_key,
  scopes: ['https://www.googleapis.com/auth/drive'],
})

await auth.authorize()
console.log('✅ auth OK — SA email:', sa.client_email)

const drive = google.drive({ version: 'v3', auth })

// Lista arquivos da pasta
const list = await drive.files.list({
  q: `'${FOLDER_ID}' in parents and trashed = false`,
  fields: 'files(id, name, mimeType)',
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
})
console.log(`✅ pasta acessível — ${list.data.files?.length ?? 0} arquivos dentro`)

// Testa escrita
const testContent = Buffer.from('teste de permissão ' + new Date().toISOString(), 'utf-8')
const up = await drive.files.create({
  requestBody: {
    name: `_test-write-${Date.now()}.txt`,
    mimeType: 'text/plain',
    parents: [FOLDER_ID],
  },
  media: { mimeType: 'text/plain', body: Buffer.from(testContent).toString() },
  fields: 'id, name',
  supportsAllDrives: true,
})
console.log('✅ escrita OK — arquivo criado:', up.data.name, '(id:', up.data.id, ')')

// Apaga o arquivo de teste
await drive.files.delete({ fileId: up.data.id, supportsAllDrives: true })
console.log('✅ limpeza OK — arquivo de teste removido')
console.log('\nTudo pronto. A Service Account pode ler e escrever na pasta.')
