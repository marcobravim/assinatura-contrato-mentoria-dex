import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'

interface Props {
  link: string
  label?: string
  size?: 'sm' | 'default' | 'icon'
  variant?: 'default' | 'outline' | 'ghost'
}

// Copia o link pro clipboard e mostra um check verde por 1.5s pra confirmar.
export function CopyLinkButton({ link, label = 'Copiar link', size = 'sm', variant = 'outline' }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copie manualmente:', link)
    }
  }

  if (size === 'icon') {
    return (
      <Button type="button" variant={variant} size="icon" onClick={handleCopy} aria-label={label} className="h-8 w-8">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      </Button>
    )
  }
  return (
    <Button type="button" variant={variant} size={size} onClick={handleCopy}>
      {copied ? (
        <><Check className="h-4 w-4 text-emerald-600" /> Copiado!</>
      ) : (
        <><Copy className="h-4 w-4" /> {label}</>
      )}
    </Button>
  )
}
