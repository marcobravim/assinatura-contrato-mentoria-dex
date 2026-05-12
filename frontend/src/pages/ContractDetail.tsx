import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, type Contract } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { formatCurrency } from '@/lib/format'
import { ArrowLeft, ExternalLink, Trash2, Mail, Link2, Loader2 } from 'lucide-react'
import { CopyLinkButton } from '@/components/CopyLinkButton'

export function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [resending, setResending] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setContract(data as Contract)
        setLoading(false)
      })

    const channel = supabase
      .channel(`contract-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contracts', filter: `id=eq.${id}` },
        (payload) => setContract(payload.new as Contract),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  async function callSignatureAction(action: 'resend' | 'generate-link'): Promise<{ ok?: boolean; link?: string; error?: string }> {
    const { data: session } = await supabase.auth.getSession()
    const token = session.session?.access_token
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signature-actions`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contract_id: contract?.id, action }),
    })
    return (await resp.json().catch(() => ({}))) as { ok?: boolean; link?: string; error?: string }
  }

  async function handleResend() {
    if (!contract) return
    setResending(true)
    const r = await callSignatureAction('resend')
    setResending(false)
    window.alert(r.ok ? 'E-mail de assinatura reenviado pro mentorado.' : `Falha: ${r.error ?? 'erro desconhecido'}`)
  }

  async function handleGenerateLink() {
    if (!contract) return
    setGeneratingLink(true)
    const r = await callSignatureAction('generate-link')
    setGeneratingLink(false)
    if (r.ok && r.link) {
      setContract({ ...contract, autentique_short_link: r.link })
      try {
        await navigator.clipboard.writeText(r.link)
        window.alert(`Novo link gerado e copiado pra área de transferência:\n${r.link}`)
      } catch {
        window.prompt('Novo link de assinatura — copie:', r.link)
      }
    } else {
      window.alert(`Falha: ${r.error ?? 'erro desconhecido'}`)
    }
  }

  async function handleDelete() {
    if (!contract) return
    const ok = window.confirm(
      `Apagar o contrato de ${contract.client_data.participante.nome}?\n\nIsso remove o registro do sistema, o PDF do Drive (vai pra lixeira, recuperável 30 dias) e o documento da Autentique. Não dá pra desfazer.`,
    )
    if (!ok) return
    setDeleting(true)
    const { error } = await supabase.functions.invoke('delete-contract', { body: { contract_id: contract.id } })
    setDeleting(false)
    if (error) {
      window.alert(`Falha ao apagar: ${error.message}`)
      return
    }
    nav('/', { replace: true })
  }

  if (loading) return <div className="container py-8">Carregando…</div>
  if (!contract) return <div className="container py-8">Contrato não encontrado.</div>

  const c = contract
  const p = c.client_data

  return (
    <div className="container max-w-3xl py-8">
      <Button asChild variant="ghost" className="mb-4">
        <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      </Button>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{p.participante.nome}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {p.modalidade === 'DUPLA' ? 'Dupla' : 'Individual'} · {p.participante.cpf_cnpj} · Criado {new Date(c.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
          <StatusBadge status={c.status} />
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><b>E-mail:</b> {p.participante.email}{p.participante.telefone ? ` · ${p.participante.telefone}` : ''}</div>
          <div><b>Endereço:</b> {p.participante.endereco}</div>
          <div><b>Data de início:</b> {new Date(p.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
          <div><b>Reserva:</b> {formatCurrency(p.valor_entrada_reserva)}</div>

          {p.socio && (
            <div className="rounded-md border p-3">
              <div className="font-medium">Sócio (2ª cadeira)</div>
              <div>{p.socio.nome} · {p.socio.cpf_cnpj}</div>
              <div className="text-muted-foreground">{p.socio.email} · {p.socio.telefone}</div>
            </div>
          )}

          <div className="rounded-md border p-3">
            <div className="font-medium">Pagamento — {p.pagamento.forma === 'VISTA' ? 'Integral' : 'Entrada + parcelado'}</div>
            <div>Total: {formatCurrency(p.pagamento.valor_total)}</div>
            {p.pagamento.forma === 'VISTA' ? (
              <div className="text-muted-foreground">
                {new Date(p.pagamento.data + 'T00:00:00').toLocaleDateString('pt-BR')} · {p.pagamento.meio_pagamento}
                {p.pagamento.meio_pagamento === 'Cartão de crédito' && (p.pagamento.parcelas_cartao ?? 1) > 1
                  ? ` em ${p.pagamento.parcelas_cartao}x`
                  : ''}
              </div>
            ) : (
              <div className="text-muted-foreground">
                Via {p.pagamento.meio_pagamento ?? 'Cartão de crédito'} · Entrada {formatCurrency(p.pagamento.entrada_valor)} em {new Date(p.pagamento.entrada_data + 'T00:00:00').toLocaleDateString('pt-BR')} · {p.pagamento.parcelas_count}x de {formatCurrency(p.pagamento.parcela_valor)} a partir de {new Date(p.pagamento.parcela_primeira_data + 'T00:00:00').toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>

          {c.autentique_short_link && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={c.autentique_short_link} target="_blank" rel="noreferrer">
                  Abrir link de assinatura <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <CopyLinkButton link={c.autentique_short_link} size="default" label="Copiar link" />
            </div>
          )}

          {c.status !== 'archived' && c.autentique_document_id && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button variant="outline" onClick={handleResend} disabled={resending}>
                {resending ? <><Loader2 className="h-4 w-4 animate-spin" /> Reenviando…</> : <><Mail className="h-4 w-4" /> Reenviar e-mail pro mentorado</>}
              </Button>
              <Button variant="outline" onClick={handleGenerateLink} disabled={generatingLink}>
                {generatingLink ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : <><Link2 className="h-4 w-4" /> Gerar novo link de assinatura</>}
              </Button>
            </div>
          )}

          {c.signed_pdf_drive_id && (
            <Button asChild>
              <a href={`https://drive.google.com/file/d/${c.signed_pdf_drive_id}/view`} target="_blank" rel="noreferrer">
                Ver PDF assinado no Drive <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}

          <div className="border-t pt-4">
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" /> {deleting ? 'Apagando…' : 'Apagar contrato'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
