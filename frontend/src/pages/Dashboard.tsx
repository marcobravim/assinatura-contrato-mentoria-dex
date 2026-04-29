import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Contract } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { formatCurrency } from '@/lib/format'
import { Plus, LogOut, Trash2 } from 'lucide-react'

export function Dashboard() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setContracts(data as Contract[])
        setLoading(false)
      })

    const channel = supabase
      .channel('contracts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, (payload) => {
        setContracts((prev) => {
          if (payload.eventType === 'INSERT') return [payload.new as Contract, ...prev]
          if (payload.eventType === 'UPDATE') {
            return prev.map((c) => (c.id === (payload.new as Contract).id ? (payload.new as Contract) : c))
          }
          if (payload.eventType === 'DELETE') return prev.filter((c) => c.id !== (payload.old as Contract).id)
          return prev
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function handleDelete(c: Contract, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const ok = window.confirm(
      `Apagar o contrato de ${c.client_data.participante.nome}?\n\nIsso remove o registro do sistema, o PDF do Drive (vai pra lixeira, recuperável 30 dias) e o documento da Autentique. Não dá pra desfazer.`,
    )
    if (!ok) return
    setContracts((prev) => prev.filter((x) => x.id !== c.id))
    const { error } = await supabase.functions.invoke('delete-contract', { body: { contract_id: c.id } })
    if (error) {
      window.alert(`Falha ao apagar: ${error.message}`)
      // rollback otimístico — recarrega
      const { data } = await supabase.from('contracts').select('*').order('created_at', { ascending: false })
      if (data) setContracts(data as Contract[])
    }
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assinatura de Contrato - Mentoria DEX</h1>
          <p className="text-muted-foreground">Seus contratos enviados para assinatura</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/novo">
              <Plus className="h-4 w-4" /> Novo contrato
            </Link>
          </Button>
          <Button variant="outline" size="icon" onClick={handleLogout} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : contracts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Nenhum contrato ainda. Clique em <b>Novo contrato</b> para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {contracts.map((c) => (
            <Card key={c.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">
                  <Link to={`/contrato/${c.id}`} className="hover:underline">
                    {c.client_data.participante.nome}
                  </Link>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <StatusBadge status={c.status} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDelete(c, e)}
                    aria-label="Apagar contrato"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>{c.client_data.modalidade === 'DUPLA' ? 'Dupla' : 'Individual'}</span>
                  <span>{c.client_data.participante.cpf_cnpj}</span>
                  <span>{formatCurrency(c.client_data.pagamento.valor_total)} · {c.client_data.pagamento.forma === 'VISTA' ? 'à vista' : 'a prazo'}</span>
                  <span>{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
