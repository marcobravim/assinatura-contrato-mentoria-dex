export const onlyDigits = (s: string) => s.replace(/\D/g, '')

export function formatCPFOrCNPJ(v: string) {
  const d = onlyDigits(v)
  if (d.length <= 11) {
    return d
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function formatPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d)/, '($1) $2-$3').trim()
  return d.replace(/^(\d{2})(\d{5})(\d)/, '($1) $2-$3').trim()
}

export function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function lookupCEP(cep: string) {
  const d = onlyDigits(cep)
  if (d.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.erro) return null
    return `${data.logradouro}, ${data.bairro}, ${data.localidade}/${data.uf}, CEP ${cep}`
  } catch {
    return null
  }
}
