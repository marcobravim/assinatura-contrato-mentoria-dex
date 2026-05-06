import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { contractSchema, type ContractFormValues } from '@/lib/validations'
import { formatCPFOrCNPJ, formatPhone, lookupCEP, onlyDigits } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, MapPin } from 'lucide-react'

export function NewContract() {
  const nav = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [cepBusca, setCepBusca] = useState('')

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      modalidade: 'INDIVIDUAL',
      data_inicio: new Date().toISOString().slice(0, 10),
      valor_entrada_reserva: 1997,
      participante: { nome: '', cpf_cnpj: '', endereco: '', telefone: '', email: '' },
      socio: null,
      pagamento: {
        forma: 'PRAZO',
        valor_total: 24997,
        entrada_valor: 1997,
        entrada_data: new Date().toISOString().slice(0, 10),
        parcelas_count: 10,
        parcela_valor: 2300,
        parcela_primeira_data: new Date().toISOString().slice(0, 10),
        meio_pagamento: 'Cartão de crédito',
      },
    },
  })

  const { register, handleSubmit, setValue, watch, formState: { errors } } = form
  const modalidade = watch('modalidade')
  const formaPgto = watch('pagamento.forma')

  async function handleCepLookup() {
    const addr = await lookupCEP(cepBusca)
    if (addr) setValue('participante.endereco', addr)
  }

  async function onSubmit(data: ContractFormValues) {
    setSubmitting(true)
    setErro(null)
    const normalized: ContractFormValues = {
      ...data,
      participante: {
        ...data.participante,
        cpf_cnpj: onlyDigits(data.participante.cpf_cnpj),
        telefone: onlyDigits(data.participante.telefone),
      },
      socio: data.socio
        ? {
            ...data.socio,
            cpf_cnpj: onlyDigits(data.socio.cpf_cnpj),
            telefone: onlyDigits(data.socio.telefone),
          }
        : null,
    }
    const { data: res, error } = await supabase.functions.invoke('create-contract', { body: normalized })
    setSubmitting(false)
    if (error) {
      setErro(error.message)
      return
    }
    nav(`/contrato/${res.contract_id}`)
  }

  function setModalidade(m: 'INDIVIDUAL' | 'DUPLA') {
    setValue('modalidade', m)
    if (m === 'DUPLA' && !watch('socio')) {
      setValue('socio', { nome: '', cpf_cnpj: '', telefone: '', email: '' })
    } else if (m === 'INDIVIDUAL') {
      setValue('socio', null)
    }
  }

  // Trocar a forma de pagamento exige reset do sub-tree porque react-hook-form
  // mantém os campos do PRAZO registrados mesmo após setValue('pagamento', {VISTA})
  // — o discriminated union do zod então falha. form.reset reescreve o objeto.
  function setFormaPgto(f: 'VISTA' | 'PRAZO') {
    const current = form.getValues()
    const today = new Date().toISOString().slice(0, 10)
    form.reset({
      ...current,
      pagamento: f === 'VISTA'
        ? {
            forma: 'VISTA',
            valor_total: current.pagamento?.valor_total ?? 19997,
            data: today,
            meio_pagamento: 'Cartão de crédito',
          }
        : {
            forma: 'PRAZO',
            valor_total: current.pagamento?.valor_total ?? 24997,
            entrada_valor: 1997,
            entrada_data: today,
            parcelas_count: 10,
            parcela_valor: 2300,
            parcela_primeira_data: today,
            meio_pagamento: 'Cartão de crédito',
          },
    })
  }

  return (
    <div className="container max-w-3xl py-8">
      <Button asChild variant="ghost" className="mb-4">
        <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      </Button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Modalidade</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex gap-2 sm:col-span-2">
              <Button type="button" variant={modalidade === 'INDIVIDUAL' ? 'default' : 'outline'} onClick={() => setModalidade('INDIVIDUAL')}>
                Individual
              </Button>
              <Button type="button" variant={modalidade === 'DUPLA' ? 'default' : 'outline'} onClick={() => setModalidade('DUPLA')}>
                Dupla
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="data_inicio">Data de início</Label>
              <Input id="data_inicio" type="date" {...register('data_inicio')} />
              {errors.data_inicio && <p className="text-xs text-destructive">{errors.data_inicio.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="valor_entrada_reserva">Valor da reserva / sinal (R$)</Label>
              <Input id="valor_entrada_reserva" type="number" step="0.01" {...register('valor_entrada_reserva')} />
              <p className="text-xs text-muted-foreground">
                Valor pago antecipadamente como garantia de vaga. Geralmente igual à entrada do parcelamento, mas pode ser diferente se houver sinal pago à parte.
              </p>
              {errors.valor_entrada_reserva && <p className="text-xs text-destructive">{errors.valor_entrada_reserva.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dados do Participante</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label>Nome completo</Label>
              <Input {...register('participante.nome')} />
              {errors.participante?.nome && <p className="text-xs text-destructive">{errors.participante.nome.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>CPF ou CNPJ</Label>
              <Input value={formatCPFOrCNPJ(watch('participante.cpf_cnpj') ?? '')} onChange={(e) => setValue('participante.cpf_cnpj', e.target.value)} />
              {errors.participante?.cpf_cnpj && <p className="text-xs text-destructive">{errors.participante.cpf_cnpj.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Telefone / WhatsApp (com DDD)</Label>
              <Input value={formatPhone(watch('participante.telefone') ?? '')} onChange={(e) => setValue('participante.telefone', e.target.value)} />
              {errors.participante?.telefone && <p className="text-xs text-destructive">{errors.participante.telefone.message}</p>}
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>E-mail (Autentique manda o link aqui)</Label>
              <Input type="email" {...register('participante.email')} />
              {errors.participante?.email && <p className="text-xs text-destructive">{errors.participante.email.message}</p>}
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Endereço completo</Label>
              <div className="flex gap-2">
                <Input placeholder="CEP (opcional, para auto-preencher)" value={cepBusca} onChange={(e) => setCepBusca(e.target.value)} className="max-w-[180px]" />
                <Button type="button" variant="outline" onClick={handleCepLookup}>
                  <MapPin className="h-4 w-4" /> Buscar
                </Button>
              </div>
              <Textarea rows={2} placeholder="Rua, número, complemento, bairro, cidade/UF, CEP" {...register('participante.endereco')} />
              {errors.participante?.endereco && <p className="text-xs text-destructive">{errors.participante.endereco.message}</p>}
            </div>
          </CardContent>
        </Card>

        {modalidade === 'DUPLA' && (
          <Card>
            <CardHeader><CardTitle>Dados do Sócio (2ª cadeira)</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label>Nome completo</Label>
                <Input {...register('socio.nome')} />
              </div>
              <div className="grid gap-2">
                <Label>CPF ou CNPJ</Label>
                <Input value={formatCPFOrCNPJ(watch('socio.cpf_cnpj') ?? '')} onChange={(e) => setValue('socio.cpf_cnpj', e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Telefone / WhatsApp</Label>
                <Input value={formatPhone(watch('socio.telefone') ?? '')} onChange={(e) => setValue('socio.telefone', e.target.value)} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>E-mail</Label>
                <Input type="email" {...register('socio.email')} />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Forma de Pagamento</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex gap-2">
              <Button type="button" variant={formaPgto === 'VISTA' ? 'default' : 'outline'} onClick={() => setFormaPgto('VISTA')}>
                Pagamento integral
              </Button>
              <Button type="button" variant={formaPgto === 'PRAZO' ? 'default' : 'outline'} onClick={() => setFormaPgto('PRAZO')}>
                Entrada + parcelado
              </Button>
            </div>

            {formaPgto === 'VISTA' ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Valor total (R$)</Label>
                  <Input type="number" step="0.01" {...register('pagamento.valor_total')} />
                </div>
                <div className="grid gap-2">
                  <Label>Data do pagamento</Label>
                  <Input type="date" {...register('pagamento.data' as const)} />
                </div>
                <div className="grid gap-2">
                  <Label>Meio de pagamento</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    {...register('pagamento.meio_pagamento' as const)}
                  >
                    <option>Cartão de crédito</option>
                    <option>PIX</option>
                    <option>Boleto</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Valor total (R$)</Label>
                  <Input type="number" step="0.01" {...register('pagamento.valor_total')} />
                </div>
                <div className="grid gap-2">
                  <Label>Meio de pagamento</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    {...register('pagamento.meio_pagamento' as const)}
                  >
                    <option>Cartão de crédito</option>
                    <option>PIX</option>
                    <option>Boleto</option>
                  </select>
                </div>
                <div className="grid gap-2 sm:col-span-1" />
                <div className="grid gap-2">
                  <Label>Entrada (R$)</Label>
                  <Input type="number" step="0.01" {...register('pagamento.entrada_valor' as const)} />
                </div>
                <div className="grid gap-2">
                  <Label>Data da entrada</Label>
                  <Input type="date" {...register('pagamento.entrada_data' as const)} />
                </div>
                <div className="grid gap-2 sm:col-span-1" />
                <div className="grid gap-2">
                  <Label>Nº de parcelas</Label>
                  <Input type="number" {...register('pagamento.parcelas_count' as const)} />
                </div>
                <div className="grid gap-2">
                  <Label>Valor de cada parcela (R$)</Label>
                  <Input type="number" step="0.01" {...register('pagamento.parcela_valor' as const)} />
                </div>
                <div className="grid gap-2">
                  <Label>Data da 1ª cobrança</Label>
                  <Input type="date" {...register('pagamento.parcela_primeira_data' as const)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild><Link to="/">Cancelar</Link></Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</> : 'Gerar e enviar para assinatura'}
          </Button>
        </div>
      </form>
    </div>
  )
}
