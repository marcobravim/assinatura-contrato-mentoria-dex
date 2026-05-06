// Converte o DOCX renderizado em PDF via Google Drive API (mesma rota da edge function).
// Salva em /tmp/contrato-test.pdf pra conferência visual.

import { google } from 'googleapis'
import fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const sa = JSON.parse(fs.readFileSync('/tmp/sa-assinatura-contrato.json', 'utf-8'))
const FOLDER_ID = '1-0Fyd5K5C4wvZIW_-lanV-Dy-XTnMS4C'

const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/drive'] })
await auth.authorize()
const drive = google.drive({ version: 'v3', auth })

const docxPath = new URL('./contrato-modelo.docx', import.meta.url)
const docxBytes = fs.readFileSync(docxPath)

// Primeiro renderiza com dados via docxtemplater (como a edge function faria)
const PizZip = (await import('pizzip')).default
const Docxtemplater = (await import('docxtemplater')).default
const zip = new PizZip(docxBytes)
const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
doc.render({
  nome_completo: 'Dra. Teste Fix',
  cpf_cnpj: '123.456.789-00',
  endereco: 'Av. Paulista, 1000, São Paulo/SP',
  telefone: '(11) 99999-8888',
  email: 'teste@exemplo.com',
  data_inicio: '15/05/2026',
  data_termino: '15/05/2027',
  data_hoje: '22/04/2026',
  modalidade: 'INDIVIDUAL',
  dupla: false,
  socio_nome: '', socio_cpf_cnpj: '', socio_telefone: '', socio_email: '',
  valor_entrada_reserva: 'R$ 1.997,00',
  forma_pagamento: 'A Prazo',
  valor_total: 'R$ 24.997,00',
  forma_vista: false,
  vista_data: '', vista_meio: '',
  forma_prazo: true,
  prazo_meio: 'Cartão de crédito',
  entrada_valor: 'R$ 1.997,00',
  entrada_data: '10/02/2026',
  parcelas_count: 10,
  parcela_valor: 'R$ 2.300,00',
  parcelas: Array.from({ length: 10 }, (_, i) => ({
    numero: `Mês ${i + 1}`,
    data: `10/${String(i + 3).padStart(2, '0')}/2026`,
    valor: 'R$ 2.300,00',
  })),
  comercial_email: 'comercial@lancio.com.br',
})
const renderedBytes = doc.getZip().generate({ type: 'nodebuffer' })

// Upload como Google Doc → export como PDF
const up = await drive.files.create({
  requestBody: { name: `test-pdf-${Date.now()}.docx`, mimeType: 'application/vnd.google-apps.document', parents: [FOLDER_ID] },
  media: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: Readable.from(renderedBytes) },
  fields: 'id',
  supportsAllDrives: true,
})
console.log('gdoc criado:', up.data.id)

const exp = await drive.files.export({ fileId: up.data.id, mimeType: 'application/pdf' }, { responseType: 'stream' })
await pipeline(exp.data, fs.createWriteStream('/tmp/contrato-test.pdf'))
console.log('PDF salvo em /tmp/contrato-test.pdf')

await drive.files.update({ fileId: up.data.id, requestBody: { trashed: true }, supportsAllDrives: true })
console.log('gdoc trashed')
