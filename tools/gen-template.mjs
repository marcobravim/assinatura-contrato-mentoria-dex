// Regenerates contrato-modelo.docx espelhando o contrato Mentoria DEX
// (Cris Miura Treinamentos). Sintaxe docxtemplater: {placeholder},
// {#cond}...{/cond} para blocos condicionais, e {#parcelas}...{/parcelas}
// para loops.

import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, TableLayoutType } from 'docx'
import fs from 'node:fs'

const P = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 120 }, alignment: opts.alignment })
const B = (text, opts = {}) => P(text, { bold: true, ...opts })
const runs = (children, opts = {}) => new Paragraph({ children, spacing: { after: 120 }, alignment: opts.alignment })
const H = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true })],
    spacing: { before: 240, after: 120 },
  })

const spacer = () => P('')

function cell(text, opts = {}) {
  return new TableCell({
    children: [P(text, opts)],
    width: { size: opts.width ?? 3000, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
  })
}

const doc = new Document({
  creator: 'CRIS MIURA TREINAMENTOS LTDA',
  title: 'Regras e Termo de Participação - Mentoria DEX',
  sections: [
    {
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'REGRAS E TERMO DE PARTICIPAÇÃO — MENTORIA DEX', bold: true, size: 28 })],
          spacing: { after: 120 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '{modalidade}', bold: true, size: 24 })],
          spacing: { after: 320 },
        }),

        H('DADOS DO PARTICIPANTE / ANUENTE'),
        runs([new TextRun({ text: 'NOME COMPLETO: ', bold: true }), new TextRun({ text: '{nome_completo}' })]),
        runs([new TextRun({ text: 'CPF/CNPJ: ', bold: true }), new TextRun({ text: '{cpf_cnpj}' })]),
        runs([new TextRun({ text: 'ENDEREÇO: ', bold: true }), new TextRun({ text: '{endereco}' })]),
        runs([new TextRun({ text: 'TELEFONE/WHATSAPP (COM DDD): ', bold: true }), new TextRun({ text: '{telefone}' })]),
        runs([new TextRun({ text: 'DATA DE INÍCIO: ', bold: true }), new TextRun({ text: '{data_inicio}' })]),
        runs([new TextRun({ text: 'DATA DE TÉRMINO: ', bold: true }), new TextRun({ text: '{data_termino}' })]),
        runs([new TextRun({ text: 'E-MAIL: ', bold: true }), new TextRun({ text: '{email}' })]),
        spacer(),

        // Bloco condicional — só aparece se modalidade = DUPLA.
        P('{#dupla}'),
        B('DADOS DO SÓCIO — 2ª CADEIRA'),
        runs([new TextRun({ text: 'NOME COMPLETO: ', bold: true }), new TextRun({ text: '{socio_nome}' })]),
        runs([new TextRun({ text: 'CPF/CNPJ: ', bold: true }), new TextRun({ text: '{socio_cpf_cnpj}' })]),
        runs([new TextRun({ text: 'TELEFONE/WHATSAPP (COM DDD): ', bold: true }), new TextRun({ text: '{socio_telefone}' })]),
        runs([new TextRun({ text: 'E-MAIL: ', bold: true }), new TextRun({ text: '{socio_email}' })]),
        spacer(),
        P('{/dupla}'),

        H('DADOS DA CONTRATADA'),
        runs([new TextRun({ text: 'RAZÃO SOCIAL: ', bold: true }), new TextRun({ text: 'CRIS MIURA TREINAMENTOS LTDA' })]),
        runs([new TextRun({ text: 'CNPJ: ', bold: true }), new TextRun({ text: '58.185.761/0001-45' })]),
        spacer(),

        P('A Mentoria DEX é um programa em grupo que acompanha e auxilia os membros na construção, venda e entrega de uma odontologia do cuidado, cujo ticket médio pode chegar a R$ 20.000,00 por tratamento periodontal não cirúrgico.'),

        runs([
          new TextRun({ text: 'É possível realizar a reserva de vaga mediante o pagamento de ' }),
          new TextRun({ text: '{valor_entrada_reserva}', bold: true }),
          new TextRun({ text: '. Esse valor possui caráter exclusivo de garantia de vaga e, por isso, em caso de não contratação do programa, não é reembolsável em qualquer hipótese.' }),
        ]),

        runs([
          new TextRun({ text: 'O acesso ao programa e a todos os seus respectivos materiais físicos e digitais é de caráter pessoal e intransferível, sendo permitido apenas aos titulares da compra identificados neste formulário. O acesso ficará disponível por 12 meses a partir de ' }),
          new TextRun({ text: '{data_inicio}', bold: true }),
          new TextRun({ text: ' (até ' }),
          new TextRun({ text: '{data_termino}', bold: true }),
          new TextRun({ text: ').' }),
        ]),

        P('Ao entrar no programa, o participante se compromete a manter todos os seus dados pessoais atualizados, bem como a efetuar os pagamentos nos termos contratados e nas datas acordadas, conforme o quadro abaixo. O não cumprimento do pagamento na data acordada acarretará a suspensão ou o cancelamento dos serviços, acessos e entrega de materiais físicos e digitais, sem prévio aviso.'),

        P('A CONTRATADA se obriga a atuar, no presente Termo, em conformidade com a Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais ("LGPD") — e somente poderá tratar os Dados Pessoais recebidos conforme as instruções do participante, com o único e exclusivo propósito de dar efetividade à participação no treinamento, podendo mantê-los por até 3 (três) anos após o encerramento do curso ou até que haja solicitação de remoção por parte do participante.'),

        runs([
          new TextRun({ text: 'Ao adquirir o programa, o participante tem o direito de permanecer por até 12 meses a partir de ' }),
          new TextRun({ text: '{data_inicio}', bold: true }),
          new TextRun({ text: ' (até ' }),
          new TextRun({ text: '{data_termino}', bold: true }),
          new TextRun({ text: '), mantendo os entregáveis e materiais durante esse período e enquanto o plano contratado estiver ativo.' }),
        ]),
        spacer(),

        H('O QUE ESTÁ INCLUSO NA MENTORIA'),
        B('I) 10 Discussões Individuais do Plano de Tratamento (DIPT)'),
        P('Encontro de 1h ao vivo no Zoom em que um dos mentores constrói o plano de tratamento do paciente junto com o mentorado antes de iniciar a Terapia Periodontal Não Cirúrgica (TPNC).'),
        B('II) 6 Análises Individuais de Atendimento (SIA ou AIA — antes ou depois do atendimento)'),
        P('Análise individual de atendimento com um Dentista Extraordinário, em que o atendimento de um paciente é analisado ou simulado. Cada análise tem duração de 1h.'),
        B('III) Comunidade DEx — exclusiva para os membros da mentoria'),
        P('Canal direto com a Dra. Cristina Miura e com os mentores para tirar dúvidas e validar estratégias durante a execução do método.'),
        B('IV) 12 DDP — Dias de Prática'),
        P('Evento, em regra aos sábados, com duração de 6h cada, voltado a combater a procrastinação e a executar as etapas indispensáveis para gerar resultados.'),
        B('V) Certificação "Sou Dentista que Salva Dentes 2026"'),
        B('VI) Participação no Sistema Nacional de Captação de Pacientes de Perio (SNCPP)'),
        P('Mais de 380 mil seguidores nas redes sociais e 7 milhões de impressões por mês.'),
        B('VII) Tráfego Pago'),
        P('Durante o período da mentoria, serão investidos R$ 2.000,00 em estratégias de captação de pacientes via tráfego pago, direcionadas a pessoas em um raio de até 20 km do consultório do mentorado, priorizando tratamentos relacionados a periodontite, mobilidade dentária, perda óssea e manutenção preventiva.'),
        B('VIII) Desafio 20k em 60 dias'),
        B('IX) Desafio 10k de PIC (1 campanha de prevenção por mês)'),
        B('X) App DEx'),
        P('Aplicativo com a rota do programa e acompanhamento do progresso financeiro do mentorado.'),
        B('XI) Plantão de Dúvidas Financeiras'),
        P('1h para tirar dúvidas e proporcionar clareza sobre o seu faturamento.'),
        B('XII) 2 Encontros Presenciais de 2 dias, em São Paulo'),
        B('XIII) Curso para TSB'),
        P('Parte gravada (RM3em1 ou Profilaxia Apaixonante regravada) e entrega ao vivo para coleta das dificuldades da equipe.'),
        B('XIV) Curso para Secretárias'),
        P('Aulas breves, ao vivo, com treinamento para vender o tratamento e cobrar antecipadamente a primeira consulta.'),
        spacer(),
        B('Bônus 1: Pós-graduação em Tratamento Periodontal Não Cirúrgico (Faculdade Focus)'),
        P('Formação completa e avançada, com conteúdos inéditos, aulas aprofundadas e artigos científicos traduzidos de forma descomplicada. São 360 horas-aula, com certificação reconhecida pelo MEC e até 24 meses para concluir a especialização no ritmo do participante.'),
        spacer(),
        P('OBSERVAÇÃO: os eventos virtuais podem ocorrer em qualquer dia e horário, inclusive em finais de semana e feriados, se necessário. Sempre que possível, serão organizados em horário comercial.'),
        spacer(),

        H('OBRIGAÇÕES FINANCEIRAS E SIGILO'),
        P('O participante é responsável pelo pagamento integral do valor do programa, tendo concluído ou não o programa contratado. Nenhum valor pago ao programa é reembolsável e não há garantia de êxito. Em caso de inadimplência, a CONTRATADA poderá suspender ou bloquear temporariamente o acesso ao programa até a total regularização.'),
        P('Nos contratos em Dupla, a inadimplência afeta ambos os membros: o acesso ao programa e aos materiais fica vetado para os dois participantes até a total regularização. Encerrado o programa e persistindo a inadimplência, a CONTRATADA tomará as providências legais cabíveis para a cobrança.'),
        P('O participante se compromete a respeitar o sigilo, a confidencialidade, a propriedade intelectual e a exclusividade das informações compartilhadas em todas as plataformas do programa. É proibida toda e qualquer forma de armazenamento, compartilhamento, distribuição ou comercialização, total ou parcial, gratuita ou onerosa, dos materiais, sem a devida autorização por escrito dos seus titulares. A prática de tais condutas configura plágio e/ou pirataria e implica a exclusão imediata do infrator, sem direito a reembolso, sem prejuízo das sanções judiciais nas esferas cível e criminal.'),
        P('Por padrão, as análises individuais do participante são disponibilizadas na área de membros para visualização pelos demais alunos. O participante pode optar pela análise privada — nesse caso, suas análises deixam de ser compartilhadas e, em contrapartida, ele também não terá acesso às análises dos demais.'),
        P('Pelo presente instrumento, o(a) participante e/ou seu representante legal autoriza(m), a título gratuito, o uso de sua imagem em fotos, filmagens e áudios coletados no programa, para peças publicitárias e institucionais da CONTRATADA e da Mentoria DEX.'),
        P('É dever do participante manter cordialidade e colaboração com os demais membros e com o time. O descumprimento pode levar à advertência e, em caso de reincidência, à retirada do grupo sem aviso prévio e sem reembolso.'),
        P('Não é permitido utilizar os meios de comunicação da mentoria para divulgar serviços ou produtos, anunciar vagas, realizar enquetes ou entrevistas, próprias ou de terceiros, sem autorização prévia da Coordenação.'),
        P('Não é permitido formar grupos paralelos em WhatsApp, Telegram, e-mail ou redes sociais, sob pena de exclusão imediata do participante.'),
        P('Não há garantia incondicional de ganhos financeiros: os resultados dependem exclusivamente da dedicação, do esforço e da aplicação correta do método por parte de cada participante. Caso esteja insatisfeito, o participante deverá comunicar a equipe para a devida avaliação, caso a caso.'),
        spacer(),

        H('CLÁUSULA DE DESISTÊNCIA'),
        P('Em caso de desistência por parte do participante após a assinatura deste contrato, será devida multa compensatória de 20% (vinte por cento) sobre o valor restante do contrato, entendido como:'),
        P('a) na modalidade à vista, o valor total do contrato subtraído do que foi efetivamente pago até a data da comunicação da desistência;'),
        P('b) na modalidade a prazo, o somatório das parcelas ainda não vencidas na data da comunicação da desistência.'),
        P('A desistência deverá ser comunicada por escrito à CONTRATADA, preferencialmente pelos canais oficiais informados no programa. O prazo para quitação da multa é de 10 (dez) dias corridos a contar da data da comunicação formal.'),
        P('A multa prevista nesta cláusula não se confunde com parcelas já vencidas e não pagas, que permanecem plenamente exigíveis.'),
        spacer(),

        H('GARANTIA CONDICIONAL'),
        P('O participante adimplente que cumprir todas as condições abaixo, chegar ao final do programa (no último evento) e não tiver faturado pelo menos R$ 20.000,00 com TPNC terá todo o valor pago na mentoria devolvido.'),
        P('Para contemplar essa garantia, o participante deverá:'),
        P('1º — Realizar o Diagnóstico de Planejamento Personalizado da Rota;'),
        P('2º — Executar TODAS as ações definidas no seu plano de ação;'),
        P('3º — Realizar pelo menos 3 Análises Individuais de Atendimento (AIA);'),
        P('4º — Participar de pelo menos 3 Discussões Individuais do Plano de Tratamento (DIPT);'),
        P('5º — Comparecer ao encontro presencial da Mentoria.'),
        spacer(),

        H('FORMA DE PAGAMENTO'),
        runs([new TextRun({ text: 'Modalidade escolhida: ', bold: true }), new TextRun({ text: '{forma_pagamento}' })]),
        runs([new TextRun({ text: 'Valor total: ', bold: true }), new TextRun({ text: '{valor_total}' })]),
        spacer(),

        // Bloco À Vista
        P('{#forma_vista}'),
        runs([
          new TextRun({ text: 'Pagamento à vista de ' }),
          new TextRun({ text: '{valor_total}', bold: true }),
          new TextRun({ text: ' em ' }),
          new TextRun({ text: '{vista_data}', bold: true }),
          new TextRun({ text: ', via ' }),
          new TextRun({ text: '{vista_meio}' }),
          new TextRun({ text: '.' }),
        ]),
        P('{/forma_vista}'),

        // Bloco A Prazo
        P('{#forma_prazo}'),
        runs([
          new TextRun({ text: 'Pagamento parcelado via ' }),
          new TextRun({ text: '{prazo_meio}', bold: true }),
          new TextRun({ text: ': entrada de ' }),
          new TextRun({ text: '{entrada_valor}', bold: true }),
          new TextRun({ text: ' em ' }),
          new TextRun({ text: '{entrada_data}', bold: true }),
          new TextRun({ text: ', seguida de ' }),
          new TextRun({ text: '{parcelas_count}', bold: true }),
          new TextRun({ text: ' parcelas mensais de ' }),
          new TextRun({ text: '{parcela_valor}', bold: true }),
          new TextRun({ text: ', conforme quadro abaixo:' }),
        ]),
        new Table({
          width: { size: 9000, type: WidthType.DXA },
          columnWidths: [2000, 4000, 3000],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                cell('Parcela', { bold: true, width: 2000 }),
                cell('Data de cobrança', { bold: true, width: 4000 }),
                cell('Valor', { bold: true, width: 3000 }),
              ],
            }),
            new TableRow({
              children: [
                cell('{#parcelas}{numero}', { width: 2000 }),
                cell('{data}', { width: 4000 }),
                cell('{valor}{/parcelas}', { width: 3000 }),
              ],
            }),
          ],
        }),
        P('{/forma_prazo}'),
        spacer(),

        P('E, por estarem assim justas e contratadas, as partes assinam o presente instrumento.'),
        runs([new TextRun({ text: 'São Paulo, {data_hoje}.', italics: true })], { alignment: AlignmentType.CENTER }),
        spacer(),
        spacer(),
        P('_______________________________________', { alignment: AlignmentType.CENTER }),
        B('Assinatura do Mentorado', { alignment: AlignmentType.CENTER }),
        P('{nome_completo}', { alignment: AlignmentType.CENTER }),
        spacer(),
        P('_______________________________________', { alignment: AlignmentType.CENTER }),
        B('CRIS MIURA TREINAMENTOS LTDA', { alignment: AlignmentType.CENTER }),
        P('CNPJ: 58.185.761/0001-45', { alignment: AlignmentType.CENTER }),
      ],
    },
  ],
})

const buf = await Packer.toBuffer(doc)
fs.writeFileSync(new URL('./contrato-modelo.docx', import.meta.url), buf)
console.log('contrato-modelo.docx regenerado (Mentoria DEX — revisado).')
