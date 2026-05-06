import { z } from 'zod'

const onlyDigits = (s: string) => s.replace(/\D/g, '')

const participanteSchema = z.object({
  nome: z.string().min(2, 'Informe o nome completo'),
  cpf_cnpj: z.string().refine((v) => {
    const d = onlyDigits(v)
    return d.length === 11 || d.length === 14
  }, 'CPF (11) ou CNPJ (14) inválido'),
  endereco: z.string().min(5, 'Informe o endereço completo'),
  telefone: z.string().refine((v) => onlyDigits(v).length >= 10, 'Telefone inválido'),
  email: z.string().email('E-mail inválido'),
})

const socioSchema = participanteSchema.omit({ endereco: true })

const meioPagamentoSchema = z.enum(['Cartão de crédito', 'PIX', 'Boleto'])

const pagamentoSchema = z.discriminatedUnion('forma', [
  z.object({
    forma: z.literal('VISTA'),
    valor_total: z.coerce.number().positive('Valor total > 0'),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    meio_pagamento: meioPagamentoSchema,
  }),
  z.object({
    forma: z.literal('PRAZO'),
    valor_total: z.coerce.number().positive('Valor total > 0'),
    entrada_valor: z.coerce.number().positive('Entrada > 0'),
    entrada_data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da entrada inválida'),
    parcelas_count: z.coerce.number().int().min(1, '1+ parcelas').max(24, 'Máximo 24'),
    parcela_valor: z.coerce.number().positive('Valor da parcela > 0'),
    parcela_primeira_data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da 1ª parcela inválida'),
    meio_pagamento: meioPagamentoSchema,
  }),
])

export const contractSchema = z
  .object({
    modalidade: z.enum(['INDIVIDUAL', 'DUPLA']),
    data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início inválida'),
    valor_entrada_reserva: z.coerce.number().positive('Informe o valor da reserva (R$)'),
    participante: participanteSchema,
    socio: socioSchema.nullable().optional(),
    pagamento: pagamentoSchema,
  })
  .superRefine((data, ctx) => {
    if (data.modalidade === 'DUPLA' && !data.socio) {
      ctx.addIssue({ code: 'custom', path: ['socio'], message: 'Dados do sócio (2ª cadeira) obrigatórios para Dupla' })
    }
  })

export type ContractFormValues = z.infer<typeof contractSchema>
