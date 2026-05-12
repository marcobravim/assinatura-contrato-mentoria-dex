// Regras de negócio compartilhadas entre form e popup de confirmação.

// Range esperado pro valor total do contrato Mentoria DEX.
// Valor fora dessa faixa não bloqueia o envio (pode ser caso legítimo),
// mas dispara um alerta de atenção pra detectar erros de digitação
// (ex: R$ 30 em vez de R$ 30.000).
export const VALOR_MIN_ESPERADO = 20000
export const VALOR_MAX_ESPERADO = 30000

export type ValorWarning = { kind: 'baixo' | 'alto'; message: string } | null

export function checkValorTotal(valor: number): ValorWarning {
  if (!Number.isFinite(valor) || valor <= 0) return null
  if (valor < VALOR_MIN_ESPERADO) {
    return {
      kind: 'baixo',
      message: `Valor abaixo do esperado para Mentoria DEX (entre R$ ${VALOR_MIN_ESPERADO.toLocaleString('pt-BR')} e R$ ${VALOR_MAX_ESPERADO.toLocaleString('pt-BR')}). Confirme se não falta um zero.`,
    }
  }
  if (valor > VALOR_MAX_ESPERADO) {
    return {
      kind: 'alto',
      message: `Valor acima do esperado para Mentoria DEX (entre R$ ${VALOR_MIN_ESPERADO.toLocaleString('pt-BR')} e R$ ${VALOR_MAX_ESPERADO.toLocaleString('pt-BR')}). Confirme se está correto.`,
    }
  }
  return null
}
