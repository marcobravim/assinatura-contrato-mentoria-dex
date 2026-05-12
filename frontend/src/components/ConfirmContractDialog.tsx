import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, Pencil, Send } from 'lucide-react'
import type { ContractFormValues } from '@/lib/validations'
import { formatCPFOrCNPJ, formatPhone, formatCurrency } from '@/lib/format'
import { checkValorTotal } from '@/lib/business-rules'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ContractFormValues | null
  submitting: boolean
  onConfirm: () => void
}

// Formata data ISO (yyyy-mm-dd) pra dd/mm/aaaa sem shift de timezone.
function fmtDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Adiciona 12 meses pra data de término (mesmo cálculo do template-data).
function addOneYear(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + 12, d))
  return dt.toISOString().slice(0, 10)
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

export function ConfirmContractDialog({ open, onOpenChange, data, submitting, onConfirm }: Props) {
  if (!data) return null
  const valorWarning = checkValorTotal(data.pagamento.valor_total)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confira antes de enviar</DialogTitle>
          <DialogDescription>
            Revise os dados abaixo. Depois de enviar, o contrato vai pro Autentique e não dá pra editar — só apagar e refazer.
          </DialogDescription>
        </DialogHeader>

        {valorWarning && (
          <div className="flex items-start gap-2 rounded-md border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <div className="font-semibold">Atenção: confira o valor antes de enviar</div>
              <div className="mt-1">{valorWarning.message}</div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Section title="Modalidade e prazo">
            <Row label="Modalidade" value={data.modalidade === 'DUPLA' ? 'Dupla' : 'Individual'} />
            <Row label="Data de início" value={fmtDate(data.data_inicio)} />
            <Row label="Data de término" value={fmtDate(addOneYear(data.data_inicio))} />
            <Row label="Reserva / sinal" value={formatCurrency(data.valor_entrada_reserva)} />
          </Section>

          <Section title="Participante">
            <Row label="Nome" value={data.participante.nome} />
            <Row label="CPF/CNPJ" value={formatCPFOrCNPJ(data.participante.cpf_cnpj)} />
            <Row label="Telefone" value={formatPhone(data.participante.telefone)} />
            <Row label="E-mail" value={data.participante.email} />
            <Row label="Endereço" value={data.participante.endereco} />
          </Section>

          {data.modalidade === 'DUPLA' && data.socio && (
            <Section title="Sócio (2ª cadeira)">
              <Row label="Nome" value={data.socio.nome} />
              <Row label="CPF/CNPJ" value={formatCPFOrCNPJ(data.socio.cpf_cnpj)} />
              <Row label="Telefone" value={formatPhone(data.socio.telefone)} />
              <Row label="E-mail" value={data.socio.email} />
            </Section>
          )}

          <Section title="Pagamento">
            <Row label="Forma" value={data.pagamento.forma === 'VISTA' ? 'Pagamento integral' : 'Entrada + parcelado'} />
            <Row label="Valor total" value={formatCurrency(data.pagamento.valor_total)} />
            <Row label="Meio" value={data.pagamento.meio_pagamento} />
            {data.pagamento.forma === 'VISTA' ? (
              <>
                <Row label="Data" value={fmtDate(data.pagamento.data)} />
                {data.pagamento.meio_pagamento === 'Cartão de crédito' && (data.pagamento.parcelas_cartao ?? 1) > 1 && (
                  <Row label="Parcelado em" value={`${data.pagamento.parcelas_cartao}x no cartão`} />
                )}
              </>
            ) : (
              <>
                <Row label="Entrada" value={`${formatCurrency(data.pagamento.entrada_valor)} em ${fmtDate(data.pagamento.entrada_data)}`} />
                <Row
                  label="Parcelas"
                  value={`${data.pagamento.parcelas_count}x de ${formatCurrency(data.pagamento.parcela_valor)} a partir de ${fmtDate(data.pagamento.parcela_primeira_data)}`}
                />
              </>
            )}
          </Section>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            <Pencil className="h-4 w-4" /> Voltar e editar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : <><Send className="h-4 w-4" /> Confirmar e enviar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
