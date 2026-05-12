import { useEffect, useState } from 'react'
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { Input } from './input'

// Formata número brasileiro: 30000 → "30.000", 1234.5 → "1.234,5", 30000.45 → "30.000,45"
function formatBR(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value) || !Number.isFinite(value)) return ''
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// Parse "1.234,50" / "1234,50" / "1234.50" → 1234.5. Aceita dígitos, ponto e vírgula.
function parseBR(text: string): number {
  if (!text) return 0
  // remove tudo que não é dígito, ponto ou vírgula
  let clean = text.replace(/[^\d.,]/g, '')
  // tira pontos de milhar (deixa só o último separador como decimal)
  // se tem vírgula → considera vírgula como decimal e remove pontos
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.')
  }
  const n = parseFloat(clean)
  return Number.isFinite(n) ? n : 0
}

interface Props<T extends FieldValues> extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'name' | 'defaultValue'> {
  control: Control<T>
  name: FieldPath<T>
}

export function MoneyInput<T extends FieldValues>({ control, name, ...inputProps }: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <MoneyInputInner value={field.value as number | undefined} onChange={field.onChange} onBlurRHF={field.onBlur} inputProps={inputProps} />}
    />
  )
}

function MoneyInputInner({
  value,
  onChange,
  onBlurRHF,
  inputProps,
}: {
  value: number | undefined
  onChange: (v: number) => void
  onBlurRHF: () => void
  inputProps: React.InputHTMLAttributes<HTMLInputElement>
}) {
  // display formatado por padrão (1.234,5); ao focar o usuário pode digitar
  // livremente, ao desfocar reformatamos pra mostrar bonito.
  const [display, setDisplay] = useState<string>(() => formatBR(value))
  const [focused, setFocused] = useState(false)

  // Sincroniza quando o value externo muda (ex: setFormaPgto que resetta).
  useEffect(() => {
    if (!focused) setDisplay(formatBR(value))
  }, [value, focused])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setDisplay(raw)
    onChange(parseBR(raw))
  }

  function handleBlur() {
    setFocused(false)
    setDisplay(formatBR(value))
    onBlurRHF()
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      {...inputProps}
      value={display}
      onFocus={() => setFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  )
}
