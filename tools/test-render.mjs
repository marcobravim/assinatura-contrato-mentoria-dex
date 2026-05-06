// Smoke test local: carrega contrato-modelo.docx, renderiza com dados fake
// e salva em /tmp para inspeção visual no Word/LibreOffice.

import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import fs from 'node:fs'

const data = {
  nome_completo: 'João da Silva Santos',
  cpf_cnpj: '123.456.789-00',
  endereco: 'Rua Teste, 123, Apto 4B, Centro, São Paulo/SP, CEP 01000-000',
  telefone: '(11) 99999-8888',
  email: 'joao.silva@exemplo.com',
  data_inicio: '15/05/2026',
  data_termino: '15/05/2027',
  data_hoje: '22/04/2026',
  modalidade: 'DUPLA',
  dupla: true,
  socio_nome: 'Maria Oliveira',
  socio_cpf_cnpj: '987.654.321-00',
  socio_telefone: '(11) 97777-6666',
  socio_email: 'maria@exemplo.com',
  valor_entrada_reserva: 'R$ 1.997,00',
  forma_pagamento: 'A Prazo',
  valor_total: 'R$ 24.997,00',
  forma_vista: false,
  vista_data: '',
  vista_meio: '',
  forma_prazo: true,
  prazo_meio: 'Cartão de crédito',
  entrada_valor: 'R$ 1.997,00',
  entrada_data: '10/02/2026',
  parcelas_count: 10,
  parcela_valor: 'R$ 2.300,00',
  parcelas: [
    { numero: 'Mês 1', data: '10/03/2026', valor: 'R$ 2.300,00' },
    { numero: 'Mês 2', data: '10/04/2026', valor: 'R$ 2.300,00' },
    { numero: 'Mês 3', data: '10/05/2026', valor: 'R$ 2.300,00' },
    { numero: 'Mês 4', data: '10/06/2026', valor: 'R$ 2.300,00' },
    { numero: 'Mês 5', data: '10/07/2026', valor: 'R$ 2.300,00' },
    { numero: 'Mês 6', data: '10/08/2026', valor: 'R$ 2.300,00' },
    { numero: 'Mês 7', data: '10/09/2026', valor: 'R$ 2.300,00' },
    { numero: 'Mês 8', data: '10/10/2026', valor: 'R$ 2.300,00' },
    { numero: 'Mês 9', data: '10/11/2026', valor: 'R$ 2.300,00' },
    { numero: 'Mês 10', data: '10/12/2026', valor: 'R$ 2.300,00' },
  ],
  comercial_email: 'comercial@lancio.com.br',
}

const tplBuf = fs.readFileSync(new URL('./contrato-modelo.docx', import.meta.url))
const zip = new PizZip(tplBuf)
const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
doc.render(data)
const out = doc.getZip().generate({ type: 'nodebuffer' })
fs.writeFileSync('/tmp/contrato-renderizado.docx', out)
console.log('Renderizado em /tmp/contrato-renderizado.docx')
