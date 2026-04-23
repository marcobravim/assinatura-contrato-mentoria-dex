import { Badge } from '@/components/ui/badge'
import type { ContractStatus } from '@/lib/supabase'

const map: Record<ContractStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'info' },
  viewed: { label: 'Visualizado', variant: 'warning' },
  signed: { label: 'Assinado', variant: 'warning' },
  rejected: { label: 'Recusado', variant: 'destructive' },
  archived: { label: 'Arquivado', variant: 'success' },
}

export function StatusBadge({ status }: { status: ContractStatus }) {
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}
