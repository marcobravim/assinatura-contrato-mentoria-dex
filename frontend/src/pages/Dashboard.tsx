import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, type Contract } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { formatCurrency } from '@/lib/format'
import { Plus, LogOut, Trash2, ExternalLink } from 'lucide-react'
import { CopyLinkButton } from '@/components/CopyLinkButton'

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
    // fetch direto (não invoke) pra ler o body do erro quando a Autentique
    // retorna não-2xx — invoke esconde a mensagem real.
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-contract`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contract_id: c.id }),
    })
    const body = await resp.json().catch(() => null) as { ok?: boolean; error?: string } | null
    if (!resp.ok || !body?.ok) {
      window.alert(`Falha ao apagar: ${body?.error ?? `HTTP ${resp.status}`}`)
      const { data } = await supabase.from('contracts').select('*').order('created_at', { ascending: false })
      if (data) setContracts(data as Contract[])
    }
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assinatura de Contrato - Mentoria DSD</h1>
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
                  {c.autentique_short_link && c.status !== 'archived' && (
                    <>
                      <CopyLinkButton link={c.autentique_short_link} size="icon" />
                      <Button
                        variant="outline"
                        size="icon"
                        asChild
                        aria-label="Abrir link de assinatura"
                        className="h-8 w-8"
                      >
                        <a
                          href={c.autentique_short_link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </>
                  )}
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
