// Shape of the data sent from the contract form. Mirrors the
// "Mentoria DEX" contract structure (Cris Miura Treinamentos).
// Kept in sync with frontend/src/lib/validations.ts.

export type Modalidade = 'INDIVIDUAL' | 'DUPLA'
export type FormaPagamento = 'VISTA' | 'PRAZO'

export interface Participante {
  nome: string
  cpf_cnpj: string
  endereco: string
  telefone: string
  email: string
}

export interface Socio {
  nome: string
  cpf_cnpj: string
  telefone: string
  email: string
}

export interface PagamentoVista {
  forma: 'VISTA'
  valor_total: number
  data: string // ISO yyyy-mm-dd
  meio_pagamento: string // ex. "Cartão de crédito"
  parcelas_cartao?: number // só relevante quando meio = Cartão; 1 = à vista no cartão
}

export interface PagamentoPrazo {
  forma: 'PRAZO'
  valor_total: number
  entrada_valor: number
  entrada_data: string
  parcelas_count: number
  parcela_valor: number
  parcela_primeira_data: string
  meio_pagamento: string
}

export type Pagamento = PagamentoVista | PagamentoPrazo

export interface ClientData {
  modalidade: Modalidade
  data_inicio: string
  valor_entrada_reserva: number
  participante: Participante
  socio: Socio | null
  pagamento: Pagamento
}

// Flat map passed to docxtemplater. Keys are the {{placeholders}} written
// in the Word template.
export function buildTemplateData(d: ClientData, opts: { comercial_email: string }) {
  const parcelas =
    d.pagamento.forma === 'PRAZO'
      ? buildParcelas(d.pagamento)
      : []

  return {
    // identidade
    nome_completo: d.participante.nome,
    cpf_cnpj: d.participante.cpf_cnpj,
    endereco: d.participante.endereco,
    telefone: d.participante.telefone,
    email: d.participante.email,
    data_inicio: formatDate(d.data_inicio),
    data_termino: formatDate(addMonths(d.data_inicio, 12)),
    data_hoje: formatDate(todayInBrasiliaISO()),
    modalidade: d.modalidade === 'DUPLA' ? 'DUPLA' : 'INDIVIDUAL',

    // sócio (2ª cadeira) — conditional {#dupla} ... {/dupla}
    dupla: d.modalidade === 'DUPLA',
    socio_nome: d.socio?.nome ?? '',
    socio_cpf_cnpj: d.socio?.cpf_cnpj ?? '',
    socio_telefone: d.socio?.telefone ?? '',
    socio_email: d.socio?.email ?? '',

    // valor da reserva/entrada (aparece no texto "R$ [VALOR ENTRADA]")
    valor_entrada_reserva: formatCurrency(d.valor_entrada_reserva),

    // pagamento — dois blocos condicionais no template: {#forma_vista}...{/forma_vista} e {#forma_prazo}...{/forma_prazo}
    forma_pagamento: d.pagamento.forma === 'VISTA' ? 'Pagamento integral' : 'Entrada + parcelado',
    valor_total: formatCurrency(d.pagamento.valor_total),
    forma_vista: d.pagamento.forma === 'VISTA',
    vista_data: d.pagamento.forma === 'VISTA' ? formatDate(d.pagamento.data) : '',
    vista_meio: d.pagamento.forma === 'VISTA' ? d.pagamento.meio_pagamento : '',
    // Sufixo " em Nx" quando o cliente parcelou no cartão (>1x). Vazio em 1x ou
    // outros meios — mantém a frase do contrato fluida sem condicional dxlt.
    vista_parcelas_label: d.pagamento.forma === 'VISTA' && d.pagamento.meio_pagamento === 'Cartão de crédito' && (d.pagamento.parcelas_cartao ?? 1) > 1
      ? ` em ${d.pagamento.parcelas_cartao}x`
      : '',
    forma_prazo: d.pagamento.forma === 'PRAZO',
    prazo_meio: d.pagamento.forma === 'PRAZO' ? (d.pagamento.meio_pagamento ?? 'Cartão de crédito') : '',
    entrada_valor: d.pagamento.forma === 'PRAZO' ? formatCurrency(d.pagamento.entrada_valor) : '',
    entrada_data: d.pagamento.forma === 'PRAZO' ? formatDate(d.pagamento.entrada_data) : '',
    parcelas_count: d.pagamento.forma === 'PRAZO' ? d.pagamento.parcelas_count : 0,
    parcela_valor: d.pagamento.forma === 'PRAZO' ? formatCurrency(d.pagamento.parcela_valor) : '',
    parcelas, // loop {#parcelas}{numero} - {data} - {valor}{/parcelas}

    // metadados do comercial que enviou
    comercial_email: opts.comercial_email,
  }
}

function buildParcelas(p: PagamentoPrazo) {
  const [y, m, d] = p.parcela_primeira_data.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  return Array.from({ length: p.parcelas_count }, (_, i) => {
    const dt = new Date(base)
    dt.setUTCMonth(dt.getUTCMonth() + i)
    return {
      numero: `Mês ${i + 1}`,
      data: formatDate(dt.toISOString().slice(0, 10)),
      valor: formatCurrency(p.parcela_valor),
    }
  })
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// 'YYYY-MM-DD' da data corrente no fuso America/Sao_Paulo.
// en-CA é o locale que por padrão formata datas como ISO YYYY-MM-DD.
function todayInBrasiliaISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

// Soma `months` meses à data ISO yyyy-mm-dd. Usa Date.UTC pra evitar shift
// de timezone. JS normaliza dias inválidos (ex: 29/02 + 12m = 01/03).
function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + months, d))
  return dt.toISOString().slice(0, 10)
}
