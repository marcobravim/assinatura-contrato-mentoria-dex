import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. Copie .env.example para .env.local.')
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export type ContractStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'rejected' | 'archived'
export type Modalidade = 'INDIVIDUAL' | 'DUPLA'

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

export type MeioPagamento = 'Cartão de crédito' | 'PIX' | 'Boleto'

export type Pagamento =
  | {
      forma: 'VISTA'
      valor_total: number
      data: string
      meio_pagamento: MeioPagamento
      // Quando meio=Cartão de crédito, em quantas vezes o cliente parcelou
      // (a Cris recebe integral, é só pra controle/contrato). 1 = à vista no cartão.
      parcelas_cartao?: number
    }
  | {
      forma: 'PRAZO'
      valor_total: number
      entrada_valor: number
      entrada_data: string
      parcelas_count: number
      parcela_valor: number
      parcela_primeira_data: string
      meio_pagamento: MeioPagamento
    }

export interface ClientData {
  modalidade: Modalidade
  data_inicio: string
  valor_entrada_reserva: number
  participante: Participante
  socio: Socio | null
  pagamento: Pagamento
}

export interface Contract {
  id: string
  created_by: string
  client_data: ClientData
  status: ContractStatus
  autentique_document_id: string | null
  autentique_short_link: string | null
  generated_pdf_path: string | null
  signed_pdf_drive_id: string | null
  created_at: string
  signed_at: string | null
  archived_at: string | null
}
