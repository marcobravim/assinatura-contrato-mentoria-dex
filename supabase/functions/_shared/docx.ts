import PizZip from 'npm:pizzip@3.1.7'
import Docxtemplater from 'npm:docxtemplater@3.65.1'

export type DocxData = Record<string, unknown>

// docxtemplater uses single-brace delimiters by default: {nome_cliente},
// {#bloco}...{/bloco} para condicionais e loops. Mantemos assim por ser
// o padrão da lib e não conflitar com o texto natural de contratos.
export function renderDocx(templateBytes: ArrayBuffer, data: DocxData): Uint8Array {
  const zip = new PizZip(templateBytes)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  })
  doc.render(data)
  return doc.getZip().generate({ type: 'uint8array' })
}
