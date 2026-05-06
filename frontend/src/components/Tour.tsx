import { useState } from 'react'
import { Joyride, type Step, type EventData, EVENTS } from 'react-joyride'
import { Button } from '@/components/ui/button'
import { GraduationCap } from 'lucide-react'

// Tour guiado passo a passo. Os steps usam seletores `data-tour="..."`
// nos elementos da página — facilita refatorar HTML sem quebrar o tour.
// O usuário pode pular ou fechar a qualquer momento.
const dashboardSteps: Step[] = [
  {
    target: '[data-tour="dashboard-title"]',
    content: 'Bem-vindo! Aqui você acompanha todos os contratos enviados pra assinatura.',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="novo-contrato"]',
    content: 'Pra criar um contrato novo, clique aqui. Você vai preencher os dados do mentorado e o sistema gera tudo automaticamente.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="contratos-lista"]',
    content: 'Cada cartão é um contrato. Clique no nome pra ver detalhes, abrir o link de assinatura ou baixar o PDF assinado.',
    placement: 'top',
  },
  {
    target: '[data-tour="status-badge"]',
    content: 'O selo colorido mostra em que etapa o contrato está: Enviado (aguardando), Visualizado, Assinado pelo mentorado, ou Arquivado (assinado pelos dois e salvo no Drive).',
    placement: 'left',
  },
  {
    target: '[data-tour="apagar-contrato"]',
    content: 'Pra apagar um contrato (em testes ou cancelado), clique aqui. Remove tudo de uma vez: dashboard, Drive e Autentique.',
    placement: 'left',
  },
  {
    target: '[data-tour="sair"]',
    content: 'Pra sair do sistema, use esse botão. Pronto, você já sabe usar! 🎉',
    placement: 'left',
  },
]

export function TourButton({ steps = dashboardSteps }: { steps?: Step[] }) {
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
