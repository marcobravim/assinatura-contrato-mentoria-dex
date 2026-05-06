import { useState } from 'react'
import { Joyride, type Step, type EventData, EVENTS } from 'react-joyride'
import { Button } from '@/components/ui/button'
import { GraduationCap } from 'lucide-react'

// Tour guiado passo a passo. Os steps usam seletores `data-tour="..."`
// nos elementos da página — facilita refatorar HTML sem quebrar o tour.
// O usuário pode pular ou fechar a qualquer momento.
const newContractSteps: Step[] = [
  {
    target: '[data-tour="modalidade"]',
    content: 'Comece escolhendo a modalidade. Individual = 1 mentorado. Dupla = 2 mentorados (a 2ª cadeira aparece como uma seção extra abaixo).',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="data-inicio"]',
    content: 'Data em que a mentoria começa pra esse cliente. A data de término é calculada automaticamente como início + 12 meses.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="valor-reserva"]',
    content: 'Quanto o cliente pagou como sinal pra garantir a vaga. Geralmente é o mesmo valor da entrada do parcelamento, mas pode ser diferente se houver sinal pago à parte.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="participante"]',
    content: 'Dados do mentorado: nome, CPF/CNPJ, telefone e e-mail. O e-mail é onde a Autentique manda o link de assinatura — confira bem.',
    placement: 'top',
  },
  {
    target: '[data-tour="endereco"]',
    content: 'Pra preencher rápido, digite o CEP e clique em Buscar — o sistema completa logradouro, bairro e cidade. Você pode ajustar depois.',
    placement: 'top',
  },
  {
    target: '[data-tour="forma-pagamento"]',
    content: 'Pagamento integral = uma única passada (cartão de uma vez, PIX, etc). Entrada + parcelado = sinal hoje + N cobranças mensais.',
    placement: 'top',
  },
  {
    target: '[data-tour="meio-pagamento"]',
    content: 'Selecione como o cliente vai pagar: Cartão de crédito, PIX ou Boleto. Aparece exatamente assim no contrato (ex: "via Cartão de crédito").',
    placement: 'top',
  },
  {
    target: '[data-tour="parcelamento"]',
    content: 'Se for parcelado: preencha entrada (valor + data), depois nº de parcelas, valor de cada uma e a data da 1ª cobrança. As outras são mensais a partir dela.',
    placement: 'top',
  },
  {
    target: '[data-tour="enviar"]',
    content: 'Quando tudo estiver preenchido, clique aqui. O sistema gera o PDF, manda pra Autentique e cria o link de assinatura. Pronto! 🎉',
    placement: 'top',
  },
]

export function TourButton({ steps = newContractSteps }: { steps?: Step[] }) {
  const [run, setRun] = useState(false)

  function handleEvent(data: EventData) {
    // Encerra o tour quando o usuário pula, fecha ou completa.
    if (data.type === EVENTS.TOUR_END || data.type === EVENTS.ERROR) {
      setRun(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setRun(true)}
        className="bg-yellow-400 text-slate-900 hover:bg-yellow-500"
        aria-label="Abrir tutorial"
      >
        <GraduationCap className="h-4 w-4" />
        Tutorial
      </Button>
      <Joyride
        steps={steps}
        run={run}
        continuous
        onEvent={handleEvent}
        locale={{
          back: 'Voltar',
          close: 'Fechar',
          last: 'Concluir',
          next: 'Próximo',
          skip: 'Pular tutorial',
        }}
        options={{
          primaryColor: '#facc15',
          textColor: '#0f172a',
          arrowColor: '#ffffff',
          backgroundColor: '#ffffff',
          zIndex: 10000,
          showProgress: true,
        }}
      />
    </>
  )
}
