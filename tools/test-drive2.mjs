import { google } from 'googleapis'
import fs from 'node:fs'

const sa = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'))
const FOLDER_ID = process.argv[3]

const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/drive'] })
await auth.authorize()
const drive = google.drive({ version: 'v3', auth })

// Criar um arquivo
const up = await drive.files.create({
  requestBody: { name: `diagnostico-${Date.now()}.txt`, mimeType: 'text/plain', parents: [FOLDER_ID] },
  media: { mimeType: 'text/plain', body: 'diag' },
  fields: 'id, name, parents, owners, driveId',
  supportsAllDrives: true,
})
console.log('upload:', JSON.stringify(up.data, null, 2))

// Esperar 3s e tentar obter o arquivo
await new Promise((r) => setTimeout(r, 3000))

const got = await drive.files.get({
  fileId: up.data.id,
  fields: 'id, name, parents, owners, driveId, trashed',
  supportsAllDrives: true,
}).catch((e) => ({ error: e.message }))
console.log('get:', JSON.stringify(got.data ?? got, null, 2))

// Lista arquivos do folder pra ver se o novo apareceu lá
const list = await drive.files.list({
  q: `'${FOLDER_ID}' in parents and trashed = false`,
  fields: 'files(id, name)',
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
})
console.log('folder contents:', list.data.files)

// Tentar delete
const del = await drive.files.delete({ fileId: up.data.id, supportsAllDrives: true }).catch((e) => ({ error: e.message, code: e.code }))
console.log('delete:', del ?? 'OK (void)')
