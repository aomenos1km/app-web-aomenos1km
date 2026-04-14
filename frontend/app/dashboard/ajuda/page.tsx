'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Plus,
  Folder,
  PenSquare,
  Gift,
  HandCoins,
  Wrench,
  FolderOpen,
  Settings,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  Download,
  X,
  Link as LinkIcon,
  List,
  ListOrdered,
  Bold,
  Italic,
  Underline,
  Check,
  GripVertical,
  Camera,
  UploadCloud,
  Paperclip,
  TriangleAlert,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  HELP_CATEGORY_ORDER,
  HELP_SECTIONS,
  type HelpCategory,
  groupSectionsByCategory,
} from '@/lib/help-center'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

const categoryIconMap: Record<HelpCategory, React.ComponentType<{ className?: string }>> = {
  'VISÃO GERAL': Gift,
  COMERCIAL: HandCoins,
  OPERACIONAL: Wrench,
  CADASTROS: FolderOpen,
  FINANCEIRO: HandCoins,
  'CONFIGURAÇÕES': Settings,
  'MATERIAL DE APOIO': Folder,
}

type MaterialAnexo = {
  name: string
  mime: string
  dataUrl: string
}

type TutorialStep = {
  id: string
  titulo: string
  descricao: string
  material?: MaterialAnexo
  print?: MaterialAnexo
}

type HelpEntry = {
  id: string
  sectionId: string
  category: HelpCategory
  ordem?: number
  titulo: string
  instrucoesHtml: string
  anexo?: MaterialAnexo
  tituloAnexo?: string
  capa?: MaterialAnexo
  videoLink?: string
  tutorialPasso: boolean
  passos: TutorialStep[]
  createdAt: string
}

const STORAGE_KEY = 'aomenos1km-help-entries-v1'

type EntryForm = {
  sectionId: string
  titulo: string
  instrucoesHtml: string
  anexo?: MaterialAnexo
  tituloAnexo: string
  capa?: MaterialAnexo
  videoLink: string
  tutorialPasso: boolean
  passos: TutorialStep[]
}

const FORM_EMPTY: EntryForm = {
  sectionId: '',
  titulo: '',
  instrucoesHtml: '',
  anexo: undefined,
  tituloAnexo: '',
  capa: undefined,
  videoLink: '',
  tutorialPasso: false,
  passos: [
    {
      id: crypto.randomUUID(),
      titulo: 'Siga esse passo 1',
      descricao: '',
    },
  ],
}

type PendingAssetRemoval =
  | { type: 'anexo' }
  | { type: 'capa' }
  | { type: 'step-material'; index: number }
  | { type: 'step-print'; index: number }

type SeedEntryDraft = {
  titulo: string
  instrucoesHtml: string
  tutorialPasso?: boolean
  passos?: TutorialStep[]
}

type SeedSectionDraft = {
  sectionId: string
  entries: SeedEntryDraft[]
}

function buildQuickstartSteps(sectionId: string, sectionLabel: string): TutorialStep[] {
  return [
    {
      id: `seed-${sectionId}-quickstart-p1`,
      titulo: 'Abrir a seção',
      descricao: `Acesse a área ${sectionLabel} no menu principal e confirme o contexto da tela.`,
    },
    {
      id: `seed-${sectionId}-quickstart-p2`,
      titulo: 'Aplicar recorte operacional',
      descricao: 'Use busca e filtros para reduzir a visualização ao cenário que você precisa resolver.',
    },
    {
      id: `seed-${sectionId}-quickstart-p3`,
      titulo: 'Validar os campos principais',
      descricao: 'Revise dados críticos (status, datas, responsáveis e valores) antes de executar qualquer ação.',
    },
    {
      id: `seed-${sectionId}-quickstart-p4`,
      titulo: 'Registrar e confirmar resultado',
      descricao: 'Finalize a ação, valide a atualização na interface e garanta rastreabilidade no histórico.',
    },
  ]
}

function appendVisualGuide(html: string, sectionLabel: string): string {
  return `${html}<p><strong>Material visual sugerido:</strong> incluir print da tela ${sectionLabel}, destacar filtros usados e indicar o botão de ação principal.</p>`
}

function buildSectionSeedEntries(sections: SeedSectionDraft[]): HelpEntry[] {
  return sections.flatMap((sectionDraft, sectionIndex) => {
    const section = HELP_SECTIONS.find(item => item.id === sectionDraft.sectionId)
    if (!section) return []

    return sectionDraft.entries.map((entry, entryIndex) => {
      const tutorialPasso = entry.tutorialPasso ?? entryIndex === 0
      const passos = entry.passos ?? (tutorialPasso ? buildQuickstartSteps(sectionDraft.sectionId, section.label) : [])
      return {
        id: `seed-${sectionDraft.sectionId}-${String(entryIndex + 1).padStart(2, '0')}`,
        sectionId: sectionDraft.sectionId,
        category: section.category,
        titulo: entry.titulo,
        instrucoesHtml: tutorialPasso
          ? appendVisualGuide(entry.instrucoesHtml, section.label)
          : entry.instrucoesHtml,
        tituloAnexo: tutorialPasso ? `Guia visual - ${section.label}` : '',
        videoLink: '',
        tutorialPasso,
        passos,
        createdAt: new Date(Date.UTC(2026, 3, 7, 8, sectionIndex, entryIndex)).toISOString(),
      }
    })
  })
}

const DEFAULT_HELP_ENTRIES: HelpEntry[] = [
  {
    id: 'seed-crm-01',
    sectionId: 'crm',
    category: 'COMERCIAL',
    titulo: 'Para que serve a tela CRM no sistema?',
    instrucoesHtml: '<p>A tela de CRM é a fila operacional de relacionamento comercial. Ela concentra as pendências de contato, prazos, responsável e histórico das interações com as empresas.</p><p>Use o CRM para organizar retornos diários, priorizar o que está atrasado e registrar cada tentativa de contato.</p>',
    tituloAnexo: '',
    videoLink: '',
    tutorialPasso: false,
    passos: [],
    createdAt: '2026-04-06T09:00:00.000Z',
  },
  {
    id: 'seed-crm-02',
    sectionId: 'crm',
    category: 'COMERCIAL',
    titulo: 'Como criar uma nova pendência no CRM?',
    instrucoesHtml: '<p>Na página CRM, clique em <strong>Nova pendência</strong>. No modal, selecione a empresa, preencha próximo contato, anotação inicial e, se necessário, defina tipo, canal, resultado, prioridade e responsável.</p><p>Ao clicar em <strong>Criar pendência</strong>, o registro entra na fila com data prevista e passa a aparecer nos indicadores.</p>',
    tituloAnexo: '',
    videoLink: '',
    tutorialPasso: true,
    passos: [
      { id: 'seed-crm-02-p1', titulo: 'Abrir o modal', descricao: 'Clique no botão Nova pendência no topo da tela CRM.' },
      { id: 'seed-crm-02-p2', titulo: 'Selecionar a empresa', descricao: 'No campo Empresa, escolha o cliente que será acompanhado.' },
      { id: 'seed-crm-02-p3', titulo: 'Definir data e anotação', descricao: 'Preencha Próximo contato e escreva a anotação inicial com contexto e próximo passo.' },
      { id: 'seed-crm-02-p4', titulo: 'Salvar', descricao: 'Clique em Criar pendência para incluir o item na fila.' },
    ],
    createdAt: '2026-04-06T09:01:00.000Z',
  },
  {
    id: 'seed-crm-03',
    sectionId: 'crm',
    category: 'COMERCIAL',
    titulo: 'Qual fluxo recomendado para trabalhar o CRM diariamente?',
    instrucoesHtml: '<p>Fluxo sugerido:</p><ul><li>Comece por pendências atrasadas.</li><li>Depois trate as pendências de hoje.</li><li>Registre cada contato no botão Registrar.</li><li>Se houve evolução, conclua ou reagende.</li><li>Se não houve retorno, mantenha a próxima ação com nova data.</li></ul><p>Esse ritmo evita perda de follow-up e mantém previsibilidade comercial.</p>',
    tituloAnexo: '',
    videoLink: '',
    tutorialPasso: false,
    passos: [],
    createdAt: '2026-04-06T09:02:00.000Z',
  },
  {
    id: 'seed-crm-04',
    sectionId: 'crm',
    category: 'COMERCIAL',
    titulo: 'Como registrar um contato em uma pendência existente?',
    instrucoesHtml: '<p>Na linha da pendência, clique em <strong>Registrar</strong>. No modal, preencha anotação, resultado e próximo contato (quando houver). Depois salve.</p><p>Esse registro alimenta o histórico da empresa e atualiza automaticamente a fila.</p>',
    tituloAnexo: '',
    videoLink: '',
    tutorialPasso: false,
    passos: [],
    createdAt: '2026-04-06T09:03:00.000Z',
  },
  {
    id: 'seed-crm-05',
    sectionId: 'crm',
    category: 'COMERCIAL',
    titulo: 'Quando usar Concluir e quando usar +1 dia?',
    instrucoesHtml: '<p>Use <strong>Concluir</strong> quando a pendência foi finalizada e não exige novo retorno imediato. Use <strong>+1 dia</strong> para manter o acompanhamento ativo quando ainda não houve desfecho.</p><p>Regra prática: se ainda existe próxima ação comercial, reagende. Se encerrou o ciclo, conclua.</p>',
    tituloAnexo: '',
    videoLink: '',
    tutorialPasso: false,
    passos: [],
    createdAt: '2026-04-06T09:04:00.000Z',
  },
  {
    id: 'seed-crm-06',
    sectionId: 'crm',
    category: 'COMERCIAL',
    titulo: 'Como funcionam os filtros da fila CRM?',
    instrucoesHtml: '<p><strong>Guia rápido de quando usar cada filtro:</strong></p><ul><li><strong>Prazo:</strong> use <strong>Atrasadas</strong> para apagar incêndio, <strong>Hoje</strong> para execução diária e <strong>Próximos 7 dias</strong> para antecipar follow-up.</li><li><strong>Status:</strong> <strong>Abertas</strong> para fila ativa, <strong>Concluídas</strong> para auditoria, <strong>Reagendadas</strong> para acompanhar itens empurrados e <strong>Canceladas</strong> para histórico.</li><li><strong>Prioridade:</strong> comece por <strong>Urgente</strong>, depois <strong>Alta</strong> e só então <strong>Normal</strong>.</li><li><strong>Consultor:</strong> use para analisar carteira de um responsável específico.</li><li><strong>Somente minhas:</strong> use para foco individual sem ruído da equipe.</li></ul><p><strong>Combinações recomendadas por cenário:</strong></p><ol><li><strong>Início do dia:</strong> Prazo = Atrasadas, Status = Abertas, Prioridade = Urgente + Alta.</li><li><strong>Rotina do dia:</strong> Prazo = Hoje, Status = Abertas, Consultor = responsável da execução.</li><li><strong>Planejamento do próximo ciclo:</strong> Prazo = Próximos 7 dias, Status = Abertas + Reagendadas.</li><li><strong>Revisão de desempenho:</strong> Status = Concluídas e comparação com os cards de Convertidos e Taxa de Conversão.</li></ol><p>Objetivo: usar filtro como ferramenta de decisão, não só como busca visual.</p>',
    tituloAnexo: '',
    videoLink: '',
    tutorialPasso: false,
    passos: [],
    createdAt: '2026-04-06T09:05:00.000Z',
  },
  {
    id: 'seed-crm-07',
    sectionId: 'crm',
    category: 'COMERCIAL',
    titulo: 'Como interpretar os cards de indicadores do CRM?',
    instrucoesHtml: '<p><strong>Leitura recomendada (card por card):</strong></p><ol><li><strong>Pendências Abertas:</strong> total de itens ativos na fila. Se subir demais, há acúmulo operacional.</li><li><strong>Para Hoje:</strong> pendências com ação prevista para hoje. Esse card define a sua prioridade diária.</li><li><strong>Em Atraso:</strong> pendências vencidas sem tratamento. Quanto maior esse número, maior o risco de perder timing comercial.</li><li><strong>Próximos 7 Dias:</strong> agenda curta do follow-up. Use para antecipar contatos e não virar atraso.</li><li><strong>Interações 30 Dias:</strong> volume de registros realizados no período.</li><li><strong>Contatos Realizados:</strong> quantidade de ações efetivamente executadas (ligação, mensagem, retorno etc.).</li><li><strong>Convertidos:</strong> quantidade de itens que avançaram para resultado positivo.</li><li><strong>Taxa de Conversão:</strong> eficiência da operação no período.</li></ol><p><strong>Como agir com base nos cards:</strong></p><ul><li>Se <strong>Em Atraso</strong> subiu, trate atrasadas antes de qualquer outra fila.</li><li>Se <strong>Para Hoje</strong> está alto, distribua por prioridade e responsável.</li><li>Se <strong>Interações</strong> está alto e <strong>Convertidos</strong> baixo, revise qualidade do contato e próximos passos.</li><li>Se há métricas de interação, mas fila aberta muito baixa, isso pode indicar que os registros foram feitos sem manter pendência ativa quando necessário.</li></ul>',
    tituloAnexo: '',
    videoLink: '',
    tutorialPasso: false,
    passos: [],
    createdAt: '2026-04-06T09:06:00.000Z',
  },
  {
    id: 'seed-crm-08',
    sectionId: 'crm',
    category: 'COMERCIAL',
    titulo: 'Qual a diferença entre Empresas e CRM no processo comercial?',
    instrucoesHtml: '<p><strong>Empresas</strong> fica focado em cadastro e consulta de histórico. <strong>CRM</strong> é o local de operação diária para criar pendências, registrar contatos e controlar follow-up.</p><p>Recomendação: execute toda rotina de relacionamento pela página CRM para manter o funil organizado.</p>',
    tituloAnexo: '',
    videoLink: '',
    tutorialPasso: false,
    passos: [],
    createdAt: '2026-04-06T09:07:00.000Z',
  },
  {
    id: 'seed-crm-09',
    sectionId: 'crm',
    category: 'COMERCIAL',
    titulo: 'Roteiro operacional de segunda-feira (CRM)',
    instrucoesHtml: '<p>Use este roteiro para começar a semana com a fila limpa e priorizada:</p><ol><li>Filtre por <strong>Atrasadas</strong> e trate primeiro os casos críticos.</li><li>Revise as pendências de <strong>Hoje</strong> e distribua por responsável.</li><li>Atualize prioridades (Normal, Alta, Urgente) conforme impacto comercial.</li><li>Registre todos os contatos feitos e já reagende próximos passos.</li><li>Feche o ciclo concluindo o que foi resolvido.</li></ol><p>No fim da rotina, os cards devem refletir uma fila realista e acionável para a semana.</p>',
    tituloAnexo: '',
    videoLink: '',
    tutorialPasso: true,
    passos: [
      { id: 'seed-crm-09-p1', titulo: 'Priorizar atrasadas', descricao: 'Acesse o filtro de prazo e selecione Atrasadas para começar pelos itens mais críticos.' },
      { id: 'seed-crm-09-p2', titulo: 'Organizar hoje e semana', descricao: 'Depois de limpar atrasos, revise Hoje e Próximos 7 dias para planejar a execução.' },
      { id: 'seed-crm-09-p3', titulo: 'Executar e registrar', descricao: 'Realize os contatos e use Registrar em cada pendência para manter histórico confiável.' },
      { id: 'seed-crm-09-p4', titulo: 'Fechar o dia', descricao: 'Conclua o que encerrou e reagende o que precisa de continuidade.' },
    ],
    createdAt: '2026-04-06T09:08:00.000Z',
  },
  {
    id: 'seed-crm-10',
    sectionId: 'crm',
    category: 'COMERCIAL',
    titulo: 'Tutorial visual: fluxo completo de uma pendência',
    instrucoesHtml: '<p>Fluxo visual recomendado para treinamento da equipe:</p><ol><li>Criar pendência no botão <strong>Nova pendência</strong>.</li><li>Registrar primeiro contato (anotação + resultado).</li><li>Definir próximo contato quando houver continuidade.</li><li>Repetir registro até desfecho.</li><li>Concluir pendência.</li></ol><p>Esse padrão cria histórico claro e facilita auditoria comercial.</p>',
    tituloAnexo: '',
    videoLink: '',
    tutorialPasso: true,
    passos: [
      { id: 'seed-crm-10-p1', titulo: 'Criação', descricao: 'Abra Nova pendência, escolha empresa e registre a anotação inicial.' },
      { id: 'seed-crm-10-p2', titulo: 'Primeiro contato', descricao: 'Clique em Registrar e documente canal, resultado e observações relevantes.' },
      { id: 'seed-crm-10-p3', titulo: 'Follow-up', descricao: 'Se necessário, informe novo próximo contato para manter o acompanhamento ativo.' },
      { id: 'seed-crm-10-p4', titulo: 'Encerramento', descricao: 'Quando houver desfecho, marque como Concluída para retirar da fila aberta.' },
    ],
    createdAt: '2026-04-06T09:09:00.000Z',
  },
  {
    id: 'seed-crm-11',
    sectionId: 'crm',
    category: 'COMERCIAL',
    titulo: 'Guia rápido de 5 minutos para novos usuários do CRM',
    instrucoesHtml: '<p>Se você está começando agora, siga esta ordem:</p><ul><li><strong>1 minuto:</strong> entenda os cards de Pendências e Métricas.</li><li><strong>1 minuto:</strong> aplique filtros (Prazo, Status e Prioridade).</li><li><strong>1 minuto:</strong> abra uma pendência e veja o histórico.</li><li><strong>1 minuto:</strong> registre um contato de teste.</li><li><strong>1 minuto:</strong> conclua ou reagende para fixar o fluxo.</li></ul><p>Em 5 minutos você já consegue operar o CRM com segurança.</p>',
    tituloAnexo: '',
    videoLink: '',
    tutorialPasso: false,
    passos: [],
    createdAt: '2026-04-06T09:10:00.000Z',
  },
  ...buildSectionSeedEntries([
    {
      sectionId: 'dashboard',
      entries: [
        {
          titulo: 'Qual a leitura rápida ideal do Dashboard no início do dia?',
          instrucoesHtml: '<p><strong>Playbook de 1 minuto:</strong> faça esta ordem de leitura: cards do topo -> Resumo Financeiro -> Performance/Funil -> Próximos Eventos/Alertas.</p><ul><li><strong>O que ver:</strong> onde estão os maiores valores, riscos e gargalos do dia.</li><li><strong>Como interpretar:</strong> o primeiro bloco mostra volume; os demais mostram qualidade e urgência.</li><li><strong>O que fazer:</strong> escolha 1 prioridade comercial e 1 prioridade operacional antes de abrir outros módulos.</li></ul><p><strong>Sugestão de print:</strong> Dashboard completo com marcações 1, 2, 3 e 4 na ordem de leitura.</p>',
        },
        {
          titulo: 'O que cada card do topo significa?',
          instrucoesHtml: '<p><strong>Playbook dos cards:</strong> Vendas Confirmadas (fechado), Pipeline (em disputa), Comissões (impacto equipe), KM Contratados (carga operacional), Perdidos/Expirados (oportunidade perdida).</p><ul><li><strong>O que ver:</strong> variação dos 5 cards no período filtrado.</li><li><strong>Como interpretar:</strong> crescimento com alta de perdidos indica problema de conversão; crescimento com KM alto indica pressão operacional.</li><li><strong>O que fazer:</strong> se perdidos subir, revisar follow-up no CRM; se KM subir, alinhar capacidade em Gestão do Evento.</li></ul><p><strong>Sugestão de print:</strong> faixa dos 5 cards com legenda curta em cada indicador.</p>',
        },
        {
          titulo: 'Como funciona o bloco Resumo Financeiro (MVP)?',
          instrucoesHtml: '<p><strong>Playbook financeiro:</strong> o bloco responde 4 perguntas: quanto foi contratado, quanto entrou, quanto falta e qual percentual já entrou.</p><ul><li><strong>O que ver:</strong> Total Contratado, Total Recebido, Saldo a Receber e % Recebido.</li><li><strong>Como interpretar:</strong> contratado alto com recebido baixo indica risco de caixa no curto prazo.</li><li><strong>O que fazer:</strong> ajuste os filtros de Período e Tipo (Comerciais/Retroativos/Todos) e direcione ação para contratos aguardando pagamento.</li></ul><p><strong>Sugestão de print:</strong> cabeçalho do Resumo Financeiro com filtros visíveis e os 4 cards destacados.</p>',
        },
        {
          titulo: 'Como ler o gráfico do Resumo Financeiro (Contratado x Recebido)?',
          instrucoesHtml: '<p><strong>Playbook do gráfico:</strong> Verde mostra contratado no mês e Azul mostra recebido no mês, sempre dentro do recorte escolhido.</p><ul><li><strong>O que ver:</strong> distância entre as barras/linhas verde e azul em cada mês (ex.: jan/2026).</li><li><strong>Como interpretar:</strong> azul abaixo do verde por vários meses seguidos sinaliza acumulação de recebíveis.</li><li><strong>O que fazer:</strong> quando houver distância recorrente, priorize cobrança e renegociação dos casos em atraso.</li></ul><p><strong>Sugestão de print:</strong> gráfico com anotações de cor (Verde=Contratado, Azul=Recebido) e destaque de 1 mês com gap alto.</p>',
        },
        {
          titulo: 'Como interpretar Performance Comercial e Distribuição do Funil?',
          instrucoesHtml: '<p><strong>Playbook comercial:</strong> Performance mostra eficiência (ticket e conversão) e Funil mostra concentração (onde o valor está parado).</p><ul><li><strong>O que ver:</strong> ticket médio, taxa de conversão e etapa com maior valor acumulado.</li><li><strong>Como interpretar:</strong> ticket bom com conversão baixa indica problema de fechamento; valor concentrado em negociação indica travamento na etapa.</li><li><strong>O que fazer:</strong> atacar a etapa mais travada com follow-up ativo no CRM e plano de fechamento no Pipeline.</li></ul><p><strong>Sugestão de print:</strong> cards Performance Comercial e Distribuição do Funil lado a lado com destaque nas métricas-chave.</p>',
        },
        {
          titulo: 'Como usar Próximos Eventos e Alertas para priorizar operação?',
          instrucoesHtml: '<p><strong>Playbook operacional:</strong> Próximos Eventos aponta urgência de data e Alertas resume nível de risco do período.</p><ul><li><strong>O que ver:</strong> eventos mais próximos, ocupação por evento e indicadores de risco.</li><li><strong>Como interpretar:</strong> data próxima com ocupação baixa pede resposta rápida comercial e de escala.</li><li><strong>O que fazer:</strong> priorizar eventos de curto prazo com menor ocupação e abrir plano de ação com responsável e prazo.</li></ul><p><strong>Sugestão de print:</strong> bloco Próximos Eventos com um evento crítico circulado e card Alertas ao lado.</p>',
        },
        {
          titulo: 'Para que serve o bloco Ações rápidas de gestão?',
          instrucoesHtml: '<p><strong>Playbook de execução:</strong> Ações Rápidas é o atalho para transformar diagnóstico em ação imediata.</p><ul><li><strong>O que ver:</strong> qual módulo resolve o problema identificado no Dashboard.</li><li><strong>Como interpretar:</strong> Dashboard decide prioridade; módulo executa a tarefa.</li><li><strong>O que fazer:</strong> clique direto no módulo alvo (Orçamentos, Pipeline, CRM, Empresas, Gestão do Evento, Histórico) sem navegar por menus.</li></ul><p><strong>Sugestão de print:</strong> card Ações Rápidas completo com destaque no atalho mais usado pela equipe.</p>',
        },
        {
          titulo: 'Quando devo sair do Dashboard e abrir outro módulo?',
          instrucoesHtml: '<p><strong>Playbook de decisão:</strong> saia do Dashboard quando a análise já apontou claramente a próxima ação.</p><ul><li><strong>O que ver:</strong> qual indicador está fora do esperado.</li><li><strong>Como interpretar:</strong> cada tipo de desvio aponta para um módulo específico.</li><li><strong>O que fazer:</strong> Pipeline (avançar etapa), CRM (follow-up), Orçamentos (nova proposta), Gestão do Evento (execução), Agenda (calendário e datas).</li></ul><p><strong>Sugestão de print:</strong> área Ações Rápidas com legenda curta: "Dashboard decide, módulo executa".</p>',
        },
      ],
    },
    {
      sectionId: 'agenda',
      entries: [
        {
          titulo: 'Como usar a Agenda para visualizar eventos do período?',
          instrucoesHtml: '<p>A Agenda foi pensada para leitura rápida do calendário operacional. Ela organiza os eventos por período e permite abrir o detalhe para verificar informações importantes sem precisar navegar por várias telas.</p><p>Comece pelo período atual e ajuste o recorte sempre que precisar revisar semanas ou datas específicas.</p>',
        },
        {
          titulo: 'O que aparece ao abrir o detalhe de um evento na Agenda?',
          instrucoesHtml: '<p>No detalhe do evento você encontra informações gerais, resumo operacional, participantes e dados financeiros ligados à vaga e ao contrato.</p><p>Esse painel serve para consulta rápida e validação antes da equipe partir para a execução mais profunda.</p>',
        },
        {
          titulo: 'Quando usar Agenda em vez de Gestão do Evento?',
          instrucoesHtml: '<p>Use <strong>Agenda</strong> para localizar e consultar rapidamente o que vai acontecer em determinado período. Use <strong>Gestão do Evento</strong> quando for preciso editar dados, controlar participantes, check-ins e etapas operacionais.</p>',
        },
      ],
    },
    {
      sectionId: 'pipeline',
      entries: [
        {
          titulo: 'Como funciona o Pipeline (Kanban)?',
          instrucoesHtml: '<p>O Pipeline organiza as oportunidades por etapa comercial. Cada card representa um evento ou contrato em andamento e cada coluna mostra em que estágio da negociação ele está.</p><p>A lógica é simples: conforme a negociação evolui, o card avança de coluna.</p>',
        },
        {
          titulo: 'Quando mover um card para outra etapa do Pipeline?',
          instrucoesHtml: '<p>Mova o card somente quando houver mudança real de status comercial, como envio de proposta, aprovação, contratação ou encerramento.</p><p>Evite mover por expectativa. O Kanban precisa refletir a situação real para que relatórios e priorização façam sentido.</p>',
        },
        {
          titulo: 'O que consultar ao abrir um contrato pelo Pipeline?',
          instrucoesHtml: '<p>Ao abrir o detalhe do contrato, revise informações gerais do evento, dados financeiros, vagas e participantes já vinculados.</p><p>Esse detalhe ajuda a confirmar se a oportunidade está pronta para avançar ou se ainda existe pendência comercial antes da próxima etapa.</p>',
        },
      ],
    },
    {
      sectionId: 'empresas',
      entries: [
        {
          titulo: 'Qual a diferença entre cadastro PJ e PF em Empresas?',
          instrucoesHtml: '<p>A tela de Empresas separa cadastros de pessoa jurídica e pessoa física para manter documentação, tipo de relacionamento e histórico corretos.</p><p>Use PJ para clientes, parceiros e organizações. Use PF para contatos individuais, representantes e perfis pessoais quando o processo exigir isso.</p>',
        },
        {
          titulo: 'Como localizar uma empresa rapidamente?',
          instrucoesHtml: '<p>Use a busca e os filtros antes de criar um cadastro novo. Procure por nome, contato principal, documento ou dados comerciais já conhecidos.</p><p>Essa checagem reduz duplicidade e preserva um histórico único por empresa.</p>',
        },
        {
          titulo: 'Quando abrir o histórico expandido de uma empresa?',
          instrucoesHtml: '<p>Abra o histórico expandido quando precisar entender o contexto completo do relacionamento: atendimentos anteriores, contratos, interações e observações salvas.</p><p>Essa consulta é especialmente útil antes de negociar novamente ou repassar o atendimento para outro consultor.</p>',
        },
      ],
    },
    {
      sectionId: 'orcamentos',
      entries: [
        {
          titulo: 'Qual é o fluxo ideal para montar um orçamento do zero?',
          instrucoesHtml: '<p><strong>Sequência recomendada (na tela):</strong></p><ol><li>No topo do gerador, clique no seletor <strong>Novos Pedidos - Formulário Público</strong> se existir lead vindo do formulário.</li><li>Preencha o card <strong>Dados do Cliente & Evento</strong> (cliente, evento, data, local e quantidade).</li><li>Monte o <strong>Escopo do Orçamento</strong> adicionando itens e ajustando quantidade/valor unitário.</li><li>Revise <strong>Termos e Condições</strong> (pagamento, validade e entrega).</li><li>Confira o <strong>Resumo Financeiro</strong> e só então clique em <strong>Gerar Orçamento</strong>.</li></ol><p>Se pular essa ordem, o total final costuma ficar divergente e gera retrabalho.</p>',
          tutorialPasso: true,
          passos: [
            { id: 'seed-orcamentos-01-p1', titulo: 'Definir origem e dados do evento', descricao: 'Vincule um pedido público quando existir e confira cliente, contato, data, local e quantidade de pessoas.' },
            { id: 'seed-orcamentos-01-p2', titulo: 'Montar escopo com itens corretos', descricao: 'Adicione os itens operacionais, revise quantidades e confirme se a infraestrutura do local está coerente.' },
            { id: 'seed-orcamentos-01-p3', titulo: 'Fechar regras comerciais', descricao: 'Ajuste pagamento, validade, entrega e observações para refletir exatamente o combinado.' },
            { id: 'seed-orcamentos-01-p4', titulo: 'Conferir totais e emitir', descricao: 'Valide subtotal, taxa local, honorários e total geral; só então gere o orçamento em PDF.' },
          ],
        },
        {
          titulo: 'Como preencher o card Dados do Cliente & Evento sem erro?',
          instrucoesHtml: '<p><strong>Passo a passo prático:</strong></p><ol><li>No campo de cliente, selecione a empresa já cadastrada. Se não existir, use o bloco de novo cliente.</li><li>Preencha <strong>Evento</strong>, <strong>Data</strong> e <strong>Hora de chegada</strong>.</li><li>No campo de local, clique em <strong>Selecionar Local</strong> e escolha o parque/local correto.</li><li>Informe <strong>Quantidade de pessoas</strong> e <strong>KM do evento</strong> (quando aplicável).</li><li>Valide e-mail e telefone do responsável antes de continuar.</li></ol><p><strong>Ponto crítico:</strong> local e quantidade de pessoas precisam estar corretos, porque impactam a taxa aplicada e o total do orçamento.</p>',
        },
        {
          titulo: 'Como montar o card Escopo do Orçamento de forma segura?',
          instrucoesHtml: '<p><strong>Como montar sem errar:</strong></p><ol><li>Clique em <strong>Adicionar item</strong> para criar uma nova linha.</li><li>No seletor de insumos, escolha o item correto por categoria.</li><li>Confira se o sistema puxou <strong>valor unitário</strong>; ajuste apenas quando necessário.</li><li>Preencha <strong>quantidade</strong> real de execução (não a estimada).</li><li>Repita para todos os itens da entrega e remova linhas em branco.</li></ol><p><strong>Checklist final do escopo:</strong> nenhum item duplicado, nenhuma quantidade zerada e nenhuma linha sem nome.</p>',
        },
        {
          titulo: 'Quando usar o card Mapa do Circuito / Imagem do Evento?',
          instrucoesHtml: '<p>Use este card quando o evento tiver rota, pontos de apoio ou montagem que precisam de referência visual.</p><ol><li>Clique em <strong>Selecionar imagem</strong>.</li><li>Escolha um arquivo legível (PNG/JPG) com marcações úteis para operação.</li><li>Após upload, confirme a pré-visualização.</li></ol><p>Se a rota mudar, substitua a imagem antes de emitir o PDF para evitar divergência entre comercial e operação.</p>',
        },
        {
          titulo: 'Como preencher corretamente o card Termos e Condições?',
          instrucoesHtml: '<p><strong>Preenchimento recomendado:</strong></p><ol><li>Defina <strong>entrada (%)</strong> conforme negociação.</li><li>Informe <strong>quantidade de parcelas</strong> e <strong>intervalo em dias</strong>.</li><li>Preencha <strong>primeiro vencimento (D+)</strong>.</li><li>Ajuste <strong>validade da proposta</strong> e <strong>prazo de entrega</strong>.</li><li>No campo de observações, registre exceções que não cabem na regra padrão.</li></ol><p>Esses campos alimentam automaticamente o texto comercial do PDF, então devem refletir exatamente o combinado com o cliente.</p>',
        },
        {
          titulo: 'Como ler o card Resumo Financeiro antes de emitir?',
          instrucoesHtml: '<p>Antes de clicar em <strong>Gerar Orçamento</strong>, valide nesta ordem:</p><ol><li><strong>Subtotal dos itens</strong> bate com o escopo montado.</li><li><strong>Taxa do local</strong> está coerente com quantidade e regra do local.</li><li><strong>Honorários/Margem</strong> atende o objetivo comercial.</li><li><strong>Total geral</strong> está dentro do valor negociado.</li><li><strong>Ticket por pessoa</strong> faz sentido para o tipo de evento.</li></ol><p>Se um desses pontos falhar, ajuste o card correspondente antes de emitir.</p>',
        },
        {
          titulo: 'Como interpretar o card Inteligência do Local?',
          instrucoesHtml: '<p>Esse card serve para auditar a taxa aplicada do local.</p><ol><li>Confira o <strong>modelo de cobrança</strong>: fixo ou por pessoa.</li><li>Confira a <strong>taxa base</strong> cadastrada no local.</li><li>Confira o <strong>gatilho/limite</strong> de pessoas configurado.</li><li>Compare com a <strong>taxa aplicada</strong> no orçamento.</li></ol><p>Regra prática: até o limite configurado, aplica setup mínimo; acima do limite, aplica a regra do local (fixo ou por pessoa).</p>',
        },
        {
          titulo: 'Quando usar Propostas Recentes e quando usar Novos Pedidos - Formulário Público?',
          instrucoesHtml: '<p><strong>Novos Pedidos - Formulário Público:</strong> use quando quiser iniciar orçamento a partir de uma solicitação nova.</p><ol><li>No card da direita, clique no pedido.</li><li>Confirme se os dados preencheram cliente, contato, local e quantidade.</li><li>Monte escopo e gere proposta.</li></ol><p><strong>Propostas Recentes:</strong> use para reabrir proposta já criada.</p><ol><li>Clique na proposta da lista.</li><li>Revise os dados carregados no formulário.</li><li>Use o ícone de impressora para abrir o PDF/HTML novamente.</li></ol>',
        },
        {
          titulo: 'Quando gerar o PDF e quando continuar editando o orçamento?',
          instrucoesHtml: '<p><strong>Gere o PDF agora</strong> quando estes 5 pontos estiverem OK: dados do evento, escopo completo, termos fechados, taxa local validada e total final aprovado.</p><p><strong>Continue editando</strong> se faltar qualquer validação comercial ou operacional, ou se houver divergência no resumo financeiro.</p><p>Objetivo: o documento gerado já deve ser a versão de apresentação ao cliente, sem necessidade de correção imediata.</p>',
        },
      ],
    },
    {
      sectionId: 'historico-propostas',
      entries: [
        {
          titulo: 'O que exatamente devo consultar no Histórico de Propostas?',
          instrucoesHtml: '<p>Use o histórico para recuperar propostas já geradas e conferir:</p><ol><li><strong>Cliente</strong>.</li><li><strong>Evento</strong>.</li><li><strong>Data de criação</strong>.</li><li><strong>Valor</strong>.</li><li><strong>Status</strong> e acesso ao documento.</li></ol><p>Essa tela responde principalmente: <strong>já existe proposta para esse caso?</strong> e <strong>qual foi a versão emitida?</strong></p>',
        },
        {
          titulo: 'Como localizar uma proposta antiga sem abrir várias linhas à toa?',
          instrucoesHtml: '<p><strong>Passo a passo:</strong></p><ol><li>Entre no <strong>Histórico de Propostas</strong>.</li><li>Use a busca por nome do cliente ou evento.</li><li>Refine por data ou status quando houver muitas opções.</li><li>Abra a proposta encontrada e confira se o contexto bate com a demanda atual.</li></ol><p>Em renegociação, sempre valide a versão certa antes de reenviar qualquer arquivo.</p>',
        },
        {
          titulo: 'Quando abrir o PDF direto pelo histórico em vez de voltar ao gerador?',
          instrucoesHtml: '<p>Abra o PDF pelo histórico quando a necessidade for <strong>consulta</strong>, <strong>reenvio</strong> ou <strong>conferência da versão emitida</strong>.</p><p>Volte ao gerador apenas quando a proposta precisar ser alterada ou refeita.</p><p>Essa separação evita comparar uma versão já enviada com um orçamento ainda em edição.</p>',
        },
      ],
    },
    {
      sectionId: 'gestao-evento',
      entries: [
        {
          titulo: 'Qual é o papel da Gestão do Evento no fluxo operacional?',
          instrucoesHtml: '<p>A <strong>Gestão do Evento</strong> é a tela de execução. Use ela quando o evento já exige acompanhamento operacional real.</p><ol><li>Abra o evento correto.</li><li>Revise dados gerais da entrega.</li><li>Confirme equipe, participantes e pendências.</li><li>Faça os ajustes necessários na operação.</li></ol><p>Se a pergunta for sobre execução, essa deve ser a tela principal.</p>',
        },
        {
          titulo: 'O que conferir na lista de participantes dentro do evento?',
          instrucoesHtml: '<p>Ao abrir a lista de participantes, revise:</p><ol><li>Se todos os nomes esperados estão vinculados.</li><li>Se os dados cadastrais estão completos.</li><li>Se existe status pendente ou problema de confirmação.</li><li>Se há observações operacionais que impactam o evento.</li></ol><p>Essa revisão é importante antes de briefing, check-in ou qualquer comunicação com a equipe.</p>',
        },
        {
          titulo: 'Quando editar o evento e quando deixar apenas em consulta?',
          instrucoesHtml: '<p><strong>Edite</strong> quando houve mudança confirmada de data, equipe, estrutura, participante ou execução.</p><p><strong>Consulte</strong> quando estiver apenas validando informação para responder alguém ou preparar a equipe.</p><p>Quanto mais próximo do evento, maior deve ser o cuidado para só editar o que realmente mudou.</p>',
        },
      ],
    },
    {
      sectionId: 'participantes',
      entries: [
        {
          titulo: 'Como usar a tela Participantes para localizar uma pessoa rapidamente?',
          instrucoesHtml: '<p><strong>Fluxo recomendado:</strong></p><ol><li>Abra <strong>Participantes</strong>.</li><li>Use a busca por nome, contato ou referência disponível.</li><li>Refine pelos filtros quando houver muitos registros.</li><li>Abra a ficha correta para validar dados antes de agir.</li></ol><p>Essa tela deve ser usada como base individual quando o foco é a pessoa, não o evento.</p>',
        },
        {
          titulo: 'Quando abrir a ficha completa de um participante?',
          instrucoesHtml: '<p>Abra a ficha completa quando precisar validar:</p><ol><li>Dados de contato.</li><li>Histórico de participação.</li><li>Informações sensíveis para a operação.</li><li>Vínculo com eventos já realizados ou futuros.</li></ol><p>Isso evita responder no escuro ou tomar decisão usando apenas a linha resumida da listagem.</p>',
        },
        {
          titulo: 'Qual a diferença entre tratar um caso em Participantes e em Gestão do Evento?',
          instrucoesHtml: '<p><strong>Participantes</strong> é melhor quando a dúvida começa pela pessoa.</p><p><strong>Gestão do Evento</strong> é melhor quando a dúvida começa pelo evento.</p><p>Regra prática: se o problema for individual, abra Participantes; se for coletivo ou ligado à execução do dia, vá para Gestão do Evento.</p>',
        },
      ],
    },
    {
      sectionId: 'historico',
      entries: [
        {
          titulo: 'Para que serve a área Histórico & Leads na prática?',
          instrucoesHtml: '<p>Essa tela cruza base histórica para responder perguntas de negócio e operação.</p><ol><li>Abra a área.</li><li>Defina primeiro o recorte da análise.</li><li>Use filtros para reduzir a leitura ao cenário real.</li><li>Abra o detalhe do registro quando precisar de confirmação fina.</li></ol><p>Não use essa tela de forma genérica. Entre com uma pergunta objetiva e filtre até achar a resposta.</p>',
        },
        {
          titulo: 'Como aplicar filtros sem transformar a análise em leitura solta?',
          instrucoesHtml: '<p><strong>Ordem recomendada de filtro:</strong></p><ol><li>Escolha o <strong>período</strong>.</li><li>Depois filtre por <strong>empresa</strong>, evento ou perfil.</li><li>Se ainda houver muito volume, refine por participante ou outra dimensão disponível.</li><li>Só então leia os resultados.</li></ol><p>O erro mais comum nessa tela é olhar tudo ao mesmo tempo e tirar conclusão fraca.</p>',
        },
        {
          titulo: 'Quando vale abrir o detalhe completo de um registro histórico?',
          instrucoesHtml: '<p>Abra o detalhe quando a linha resumida não bastar para decidir.</p><ol><li>Se houver dúvida sobre histórico individual.</li><li>Se precisar confirmar comportamento anterior.</li><li>Se a equipe quiser validar relação com outros eventos.</li><li>Se a informação impactar ação comercial ou operacional.</li></ol><p>Use o detalhe para confirmar, não para substituir a lógica de filtro inicial.</p>',
        },
      ],
    },
    {
      sectionId: 'insumos',
      entries: [
        {
          titulo: 'Como cadastrar um novo insumo ou serviço sem poluir a base?',
          instrucoesHtml: '<p><strong>Passo a passo:</strong></p><ol><li>Abra <strong>Insumos & Serviços</strong>.</li><li>Pesquise antes para garantir que o item ainda não existe.</li><li>Clique para criar novo cadastro.</li><li>Preencha nome claro, categoria, unidade e valor.</li><li>Salve somente se o item realmente puder ser reutilizado em orçamento ou operação.</li></ol><p>Item duplicado ou mal nomeado enfraquece orçamento, leitura de custo e padronização interna.</p>',
        },
        {
          titulo: 'Como preencher categoria, unidade e valor de forma coerente?',
          instrucoesHtml: '<p><strong>Categoria</strong> organiza o item dentro da base.</p><p><strong>Unidade</strong> define como ele será medido ou cobrado.</p><p><strong>Valor</strong> é a referência financeira que o sistema vai puxar para orçamento.</p><p>Antes de salvar, leia a combinação em voz lógica: <strong>este item será cobrado nessa unidade por esse valor</strong>. Se a frase não fizer sentido, o cadastro ainda está errado.</p>',
        },
        {
          titulo: 'Quando editar um item existente e quando criar um novo?',
          instrucoesHtml: '<p><strong>Edite</strong> quando a mudança for preço, descrição ou ajuste do mesmo recurso.</p><p><strong>Crie novo</strong> quando o serviço, material ou lógica de cobrança for realmente diferente.</p><p>Se o time pudesse confundir um item com o outro no orçamento, então eles merecem cadastros separados.</p>',
        },
      ],
    },
    {
      sectionId: 'locais',
      entries: [
        {
          titulo: 'Como cadastrar um local de forma que ele sirva para orçamento e operação?',
          instrucoesHtml: '<p><strong>Preenchimento recomendado:</strong></p><ol><li>Cadastre <strong>nome</strong> e <strong>cidade</strong> corretamente.</li><li>Preencha capacidade, restrições e observações operacionais.</li><li>Configure taxa e modelo de cobrança do local.</li><li>Revise tudo antes de salvar.</li></ol><p>Um bom cadastro de local precisa responder: <strong>quanto custa operar aqui e o que a equipe precisa saber antes de vender</strong>.</p>',
        },
        {
          titulo: 'Quais campos do local mais impactam o valor do orçamento?',
          instrucoesHtml: '<p>Antes de montar proposta, revise principalmente:</p><ol><li><strong>Capacidade</strong>.</li><li><strong>Taxa do local</strong>.</li><li><strong>Tipo de cobrança</strong> do local.</li><li><strong>Limitações operacionais</strong>.</li><li><strong>Cidade ou deslocamento</strong> quando isso influenciar custo.</li></ol><p>Se um desses campos estiver errado, a proposta pode sair bonita e financeiramente errada.</p>',
        },
        {
          titulo: 'Quando atualizar taxa, capacidade ou regra do local?',
          instrucoesHtml: '<p>Atualize o cadastro assim que houver confirmação de mudança.</p><ol><li>Nova taxa.</li><li>Nova limitação de capacidade.</li><li>Mudança de política comercial do espaço.</li><li>Nova restrição operacional relevante.</li></ol><p>Não trate essas mudanças só no orçamento atual. O cadastro-base precisa continuar confiável para os próximos orçamentos também.</p>',
        },
      ],
    },
    {
      sectionId: 'parceiros',
      entries: [
        {
          titulo: 'O que realmente deve entrar em Parceiros & Staff?',
          instrucoesHtml: '<p>Cadastre aqui quem participa com recorrência na entrega ou apoio do evento.</p><ol><li>Abra <strong>Parceiros & Staff</strong>.</li><li>Pesquise se a pessoa já existe.</li><li>Cadastre contato, função e observações úteis.</li><li>Salve apenas se for alguém que a operação possa precisar reutilizar.</li></ol><p>A base deve ajudar a montar equipe e relacionamento. Se o registro não ajuda nisso, talvez não devesse estar aqui.</p>',
        },
        {
          titulo: 'Como separar parceiro de staff de forma consistente?',
          instrucoesHtml: '<p><strong>Parceiro</strong> é relação externa, apoio estratégico ou profissional que atua como apoio recorrente.</p><p><strong>Staff</strong> é quem entra mais diretamente na execução prática do evento.</p><p>Se a pessoa é lembrada primeiro pela função de campo, tende a ser staff. Se é lembrada pelo vínculo de apoio ou relacionamento, tende a ser parceiro.</p>',
        },
        {
          titulo: 'Quando consultar Parceiros & Staff durante o planejamento do evento?',
          instrucoesHtml: '<p>Consulte esse módulo quando precisar:</p><ol><li>Montar equipe.</li><li>Validar quem atende determinada praça.</li><li>Relembrar contatos recorrentes.</li><li>Escolher apoio operacional por função.</li></ol><p>Ele funciona como memória operacional da equipe e reduz improviso na montagem da entrega.</p>',
        },
      ],
    },
    {
      sectionId: 'fornecedores',
      entries: [
        {
          titulo: 'Quando vale cadastrar um fornecedor novo?',
          instrucoesHtml: '<p>Cadastre um fornecedor quando ele já tiver utilidade real para cotação, compra, entrega ou apoio recorrente.</p><ol><li>Pesquise antes para evitar duplicidade.</li><li>Cadastre nome, contato e especialidade.</li><li>Adicione cidade e observações úteis.</li><li>Salve apenas quando a equipe realmente puder acionar esse fornecedor.</li></ol><p>Fornecedor sem papel claro vira ruído e dificulta busca futura.</p>',
        },
        {
          titulo: 'Quais dados mínimos precisam estar corretos em um fornecedor?',
          instrucoesHtml: '<p>Antes de considerar o cadastro confiável, confirme:</p><ol><li><strong>Nome</strong>.</li><li><strong>Contato</strong>.</li><li><strong>Cidade ou região</strong>.</li><li><strong>Especialidade</strong>.</li><li><strong>Observações operacionais</strong> importantes.</li></ol><p>Esses dados são o mínimo para que a equipe consiga localizar e acionar o fornecedor sem retrabalho.</p>',
        },
        {
          titulo: 'Como usar a base de fornecedores na rotina do time?',
          instrucoesHtml: '<p>Use essa base quando surgir demanda de compra, cotação ou reposição.</p><ol><li>Procure por categoria ou região.</li><li>Revise os fornecedores compatíveis.</li><li>Abra o cadastro para validar observações e contato.</li><li>Acione o fornecedor correto com base no contexto do evento.</li></ol><p>O ganho dessa área está em reduzir tempo de resposta, não apenas guardar nomes.</p>',
        },
      ],
    },
    {
      sectionId: 'comissoes',
      entries: [
        {
          titulo: 'Como fazer a leitura inicial da tela de Comissões?',
          instrucoesHtml: '<p><strong>Ordem recomendada:</strong></p><ol><li>Abra <strong>Comissões</strong>.</li><li>Leia primeiro os cards do topo.</li><li>Depois desça para a listagem detalhada.</li><li>Só então confirme casos específicos por linha.</li></ol><p>Os cards respondem a visão geral. A tabela responde o detalhe operacional do que está pendente ou já foi liquidado.</p>',
        },
        {
          titulo: 'Qual é a diferença prática entre comissão pendente e paga?',
          instrucoesHtml: '<p><strong>Pendente</strong> significa valor previsto, mas ainda não liquidado.</p><p><strong>Paga</strong> significa valor já concluído no fluxo financeiro.</p><p>Quando houver dúvida, trate a comissão pendente como expectativa e a comissão paga como valor efetivo. Misturar essas duas leituras gera erro de comunicação com a equipe.</p>',
        },
        {
          titulo: 'Como o perfil do usuário muda a experiência em Comissões?',
          instrucoesHtml: '<p><strong>Consultor</strong> costuma ver apenas o que precisa acompanhar.</p><p><strong>Administrador</strong> enxerga a gestão mais completa do módulo, com conferência e ações adicionais.</p><p>Se um botão, valor ou coluna não aparecer, valide primeiro o perfil do usuário antes de assumir que existe erro na tela.</p>',
        },
      ],
    },
    {
      sectionId: 'financeiro-contratos',
      entries: [
        {
          titulo: 'Qual é o fluxo certo para montar um plano de parcelas em Financeiro de Contratos?',
          instrucoesHtml: '<p><strong>Sequência recomendada:</strong></p><ol><li>Abra <strong>Financeiro de Contratos</strong>.</li><li>No card <strong>Plano de Parcelas por Contrato</strong>, selecione o contrato.</li><li>Confira sugestão comercial, quantidade de parcelas e primeiro vencimento.</li><li>Clique em <strong>Gerar plano automático</strong>.</li><li>Revise a tabela das parcelas e clique em <strong>Salvar plano</strong>.</li></ol><p>Esse fluxo evita salvar cronograma manual sem coerência com o valor contratado.</p>',
          tutorialPasso: true,
          passos: [
            { id: 'seed-financeiro-contratos-01-p1', titulo: 'Selecionar o contrato', descricao: 'Escolha o contrato correto no seletor e confirme evento, empresa e valor contratado no resumo lateral.' },
            { id: 'seed-financeiro-contratos-01-p2', titulo: 'Ajustar regras do plano', descricao: 'Confira quantidade de parcelas, primeiro vencimento, forma esperada e observação do plano.' },
            { id: 'seed-financeiro-contratos-01-p3', titulo: 'Gerar e revisar', descricao: 'Clique em Gerar plano automático e valide vencimentos, valores e indicação de entrada.' },
            { id: 'seed-financeiro-contratos-01-p4', titulo: 'Salvar o cronograma', descricao: 'Se a soma do plano estiver correta, clique em Salvar plano para gravar as parcelas pendentes.' },
          ],
        },
        {
          titulo: 'Como conferir se o contrato selecionado é o certo antes de salvar o plano?',
          instrucoesHtml: '<p>Depois de escolher o contrato, confira imediatamente o card <strong>Resumo do Contrato</strong>.</p><ol><li>Valide <strong>evento</strong>.</li><li>Valide <strong>empresa</strong>.</li><li>Valide <strong>data do evento</strong>.</li><li>Valide <strong>valor contratado</strong>.</li><li>Compare com o que foi combinado comercialmente.</li></ol><p>Se qualquer um desses campos estiver divergente, não gere o plano ainda.</p>',
        },
        {
          titulo: 'Quando usar o plano automático e quando editar as parcelas manualmente?',
          instrucoesHtml: '<p><strong>Use o plano automático</strong> quando o contrato segue a lógica comercial padrão da proposta.</p><p><strong>Edite manualmente</strong> quando houver negociação fora do padrão, datas específicas exigidas pelo cliente ou necessidade de redistribuir valores.</p><p>Depois de gerar automaticamente, você ainda pode ajustar vencimento, forma e valor diretamente na tabela antes de salvar.</p>',
        },
        {
          titulo: 'Como registrar a baixa de uma parcela sem errar o financeiro?',
          instrucoesHtml: '<p><strong>Passo a passo:</strong></p><ol><li>Na tabela <strong>Parcelas no Financeiro</strong>, localize a parcela pendente.</li><li>Clique em <strong>Dar baixa</strong>.</li><li>No modal, preencha <strong>valor recebido</strong>, <strong>data do pagamento</strong> e <strong>forma realizada</strong>.</li><li>Adicione observação se houver diferença em relação ao previsto.</li><li>Confirme a baixa.</li></ol><p>Use observação sempre que o valor recebido ou a forma realizada não baterem com o planejado.</p>',
        },
        {
          titulo: 'Como usar a listagem Parcelas no Financeiro para cobrança e conferência?',
          instrucoesHtml: '<p>Use essa listagem como fila de trabalho.</p><ol><li>Filtre por <strong>status</strong> para ver apenas pendentes ou recebidas.</li><li>Use a busca por evento ou empresa.</li><li>Leia vencimento, valor previsto e valor recebido.</li><li>Priorize as parcelas pendentes mais urgentes para cobrança.</li></ol><p>Se o Dashboard mostrar caixa pressionado, essa é a primeira tela a abrir para localizar onde o recebimento travou.</p>',
        },
      ],
    },
    {
      sectionId: 'config',
      entries: [
        {
          titulo: 'O que a tela Configurações controla de fato no sistema?',
          instrucoesHtml: '<p>A tela <strong>Configurações</strong> define regras globais que afetam mais de um módulo.</p><ol><li><strong>Formulário Público</strong>.</li><li><strong>Preços de segurança</strong> de backup.</li><li><strong>Orçamento Interno</strong>.</li><li><strong>Política de Pagamento</strong>.</li><li><strong>Metas Mensais</strong>.</li></ol><p>Qualquer alteração aqui pode refletir em proposta, contrato, lead recebido e leitura do Dashboard.</p>',
        },
        {
          titulo: 'Quando mexer nas regras do Formulário Público do site?',
          instrucoesHtml: '<p>Altere esse bloco quando houver mudança oficial na forma como o site deve precificar ou coletar pedidos.</p><ol><li>Revise margem de lucro.</li><li>Revise custo operacional fixo.</li><li>Revise adicional de kit premium.</li><li>Salve e valide se a mudança faz sentido comercialmente.</li></ol><p>Esses campos afetam a entrada de novas solicitações, então não devem ser alterados por tentativa e erro.</p>',
        },
        {
          titulo: 'Como revisar corretamente as regras do Orçamento Interno?',
          instrucoesHtml: '<p>No bloco <strong>Regras: Orçamento Interno</strong>, confira:</p><ol><li><strong>Taxa Setup Mínimo</strong>.</li><li><strong>Limite (Pessoas)</strong>.</li><li>Se a regra atual faz sentido para a operação.</li></ol><p>Depois de alterar, o ideal é abrir o <strong>Gerador de Orçamentos</strong> e validar um caso real para confirmar que a nova regra está se comportando como esperado.</p>',
        },
        {
          titulo: 'Quando usar os Preços de Segurança (Backup) e por que isso importa?',
          instrucoesHtml: '<p>Esse bloco define valores de contingência para itens como camiseta, medalha, squeeze, bag, lanche e troféu.</p><p>Esses preços entram em ação quando o item não é encontrado em <strong>Insumos & Serviços</strong>.</p><ol><li>Revise os valores com cuidado.</li><li>Mantenha coerência com a base principal.</li><li>Evite usar esse bloco como preço oficial do catálogo.</li></ol><p>Se esse backup estiver desatualizado, o orçamento pode sair com valor de segurança incorreto sem que a equipe perceba na hora.</p>',
        },
        {
          titulo: 'Como preencher corretamente Política de Pagamento e Metas Mensais?',
          instrucoesHtml: '<p><strong>Na Política de Pagamento</strong>, revise entrada mínima, máximo de parcelas, multa, juros, formas disponíveis e o texto padrão comercial.</p><p><strong>Nas Metas Mensais</strong>, escolha o ano, abra cada mês e preencha meta de vendas, meta de contratos e descrição.</p><p>Salve cada mês individualmente para não perder ajustes. Esse bloco impacta tanto a comunicação comercial quanto a leitura de metas no Dashboard.</p>',
        },
      ],
    },
    {
      sectionId: 'usuarios',
      entries: [
        {
          titulo: 'Como criar um novo usuário da equipe sem dar acesso errado?',
          instrucoesHtml: '<p><strong>Passo a passo:</strong></p><ol><li>Abra <strong>Usuários & Equipe</strong>.</li><li>Clique para criar novo usuário.</li><li>Preencha nome, e-mail e demais dados solicitados.</li><li>Escolha o perfil correto.</li><li>Revise antes de salvar.</li></ol><p>O ponto mais crítico não é o cadastro em si, mas o <strong>perfil</strong> escolhido. Ele precisa refletir a função real da pessoa na operação.</p>',
        },
        {
          titulo: 'Como decidir o perfil correto de acesso para cada pessoa?',
          instrucoesHtml: '<p><strong>Administrador</strong> deve ficar com quem precisa configurar, liberar, editar áreas sensíveis ou manter o sistema.</p><p><strong>Consultor</strong> deve ficar com quem precisa operar a rotina sem acesso amplo de configuração.</p><p>Se existir dúvida, escolha o menor acesso possível e só amplie depois que a necessidade estiver clara.</p>',
        },
        {
          titulo: 'Quando bloquear, editar ou revisar permissões de um usuário?',
          instrucoesHtml: '<p>Revise permissões quando houver:</p><ol><li>Mudança de função.</li><li>Saída da pessoa da operação.</li><li>Necessidade temporária de restringir acesso.</li><li>Percepção de que o acesso atual está excessivo.</li></ol><p>Não espere incidente para revisar isso. Permissão é parte da operação, não apenas detalhe administrativo.</p>',
        },
      ],
    },
    {
      sectionId: 'central-ajuda',
      entries: [
        {
          titulo: 'Como navegar na Central de Ajuda sem perder tempo?',
          instrucoesHtml: '<p><strong>Fluxo recomendado:</strong></p><ol><li>Abra a <strong>Central de Ajuda</strong>.</li><li>Escolha primeiro a <strong>categoria</strong> do tema.</li><li>Depois abra a <strong>seção</strong> do sistema correspondente.</li><li>Por fim, escolha a pergunta específica.</li></ol><p>Essa ordem reduz ruído e faz a busca chegar mais rápido na dúvida real da equipe.</p>',
        },
        {
          titulo: 'Como criar ou reorganizar conteúdos da ajuda de forma útil?',
          instrucoesHtml: '<p>Ao criar conteúdo novo, siga esta ordem:</p><ol><li>Escolha a <strong>seção</strong> correta.</li><li>Escreva um <strong>título em formato de pergunta real</strong>.</li><li>Preencha a instrução com passo a passo de tela.</li><li>Anexe material visual quando fizer sentido.</li><li>Reorganize a ordem para deixar as dúvidas mais frequentes primeiro.</li></ol><p>Um bom conteúdo resolve um problema real sem depender de explicação paralela.</p>',
        },
        {
          titulo: 'Qual é o padrão ideal para manter os materiais da ajuda consistentes?',
          instrucoesHtml: '<p>Use 4 regras simples:</p><ol><li>Título em forma de pergunta real.</li><li>Texto ensinando <strong>onde clicar</strong> e <strong>o que conferir</strong>.</li><li>Uma dúvida por conteúdo.</li><li>Atualização sempre que o fluxo do sistema mudar.</li></ol><p>Como consultores ficam em leitura, a curadoria precisa ser mantida por quem realmente cuida da estrutura da ajuda.</p>',
        },
      ],
    },
  ]),
]

const DEFAULT_HELP_ENTRIES_PLAYBOOK: HelpEntry[] = DEFAULT_HELP_ENTRIES.map(entry => {
  if (!entry.id.startsWith('seed-')) return entry

  const sectionLabel = HELP_SECTIONS.find(section => section.id === entry.sectionId)?.label ?? entry.sectionId

  return {
    ...entry,
    instrucoesHtml: entry.tutorialPasso
      ? appendVisualGuide(entry.instrucoesHtml, sectionLabel)
      : entry.instrucoesHtml,
  }
})

function mergeWithDefaultEntries(existing: HelpEntry[]) {
  const defaultById = new Map(DEFAULT_HELP_ENTRIES_PLAYBOOK.map(entry => [entry.id, entry]))

  const refreshed = existing.flatMap(entry => {
    if (!entry.id.startsWith('seed-')) return entry

    const seedEntry = defaultById.get(entry.id)
    if (!seedEntry) return []

    return [{
      ...seedEntry,
      ordem: entry.ordem,
    }]
  })

  const existingIds = new Set(refreshed.map(entry => entry.id))
  const missing = DEFAULT_HELP_ENTRIES_PLAYBOOK.filter(entry => !existingIds.has(entry.id))
  return normalizeEntriesOrder([...missing, ...refreshed])
}

function sortEntries(a: HelpEntry, b: HelpEntry) {
  const aOrdem = a.ordem ?? Number.MAX_SAFE_INTEGER
  const bOrdem = b.ordem ?? Number.MAX_SAFE_INTEGER
  if (aOrdem !== bOrdem) return aOrdem - bOrdem
  if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt)
  return a.id.localeCompare(b.id)
}

function normalizeEntriesOrder(list: HelpEntry[]) {
  const entriesWithIndex = list.map((entry, index) => ({ entry, index }))
  const bySection = new Map<string, Array<{ entry: HelpEntry; index: number }>>()

  entriesWithIndex.forEach(item => {
    const arr = bySection.get(item.entry.sectionId) ?? []
    arr.push(item)
    bySection.set(item.entry.sectionId, arr)
  })

  const normalizedByIndex = new Map<number, HelpEntry>()
  bySection.forEach(items => {
    const sorted = [...items].sort((a, b) => {
      const ordA = a.entry.ordem ?? Number.MAX_SAFE_INTEGER
      const ordB = b.entry.ordem ?? Number.MAX_SAFE_INTEGER
      if (ordA !== ordB) return ordA - ordB
      return a.index - b.index
    })

    sorted.forEach((item, idx) => {
      normalizedByIndex.set(item.index, { ...item.entry, ordem: idx + 1 })
    })
  })

  return entriesWithIndex.map(item => normalizedByIndex.get(item.index) ?? item.entry)
}

function getInitialHelpEntries() {
  if (typeof window === 'undefined') return DEFAULT_HELP_ENTRIES_PLAYBOOK

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_HELP_ENTRIES_PLAYBOOK

    const parsed = JSON.parse(raw) as HelpEntry[]
    return mergeWithDefaultEntries(parsed)
  } catch {
    return DEFAULT_HELP_ENTRIES_PLAYBOOK
  }
}

export default function CentralAjudaPage() {
  const { user } = useAuth()
  const isConsultor = user?.perfil === 'Consultor'
  const canReorderEntries = user?.perfil === 'Admin'
  const [busca, setBusca] = useState('')
  const [openEstrutura, setOpenEstrutura] = useState(false)
  const [openConteudo, setOpenConteudo] = useState(false)
  const [openLightbox, setOpenLightbox] = useState<MaterialAnexo | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null)
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HelpEntry | null>(null)
  const [pendingAssetRemoval, setPendingAssetRemoval] = useState<PendingAssetRemoval | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingProgress, setSavingProgress] = useState(0)
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null)
  const [dragOverEntryId, setDragOverEntryId] = useState<string | null>(null)
  const [showLinkEditor, setShowLinkEditor] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [editorInstanceKey, setEditorInstanceKey] = useState(0)
  const [form, setForm] = useState<EntryForm>(FORM_EMPTY)
  const [entries, setEntries] = useState<HelpEntry[]>(getInitialHelpEntries)
  const richTextRef = useRef<HTMLDivElement | null>(null)
  const linkInputRef = useRef<HTMLInputElement | null>(null)
  const pendingEditorHtmlRef = useRef('')
  const savedRangeRef = useRef<Range | null>(null)
  const accordionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const grouped = groupSectionsByCategory()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        toast.error('Armazenamento local cheio. Tente remover anexos grandes ou apagar entradas antigas.')
      }
    }
  }, [entries])

  useEffect(() => {
    if (!showLinkEditor) return
    setTimeout(() => linkInputRef.current?.focus(), 0)
  }, [showLinkEditor])

  useLayoutEffect(() => {
    if (!openConteudo || !richTextRef.current) return
    richTextRef.current.innerHTML = pendingEditorHtmlRef.current || ''
  }, [openConteudo, editorInstanceKey])

  const setRichTextElement = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      richTextRef.current = null
      return
    }
    richTextRef.current = el
    el.innerHTML = pendingEditorHtmlRef.current || ''
  }, [])

  const cards = useMemo(() => {
    const termo = busca.toLowerCase().trim()
    return HELP_CATEGORY_ORDER
      .map(category => {
        const sections = grouped[category]
        const filtradas = termo
          ? sections.filter(section => section.label.toLowerCase().includes(termo))
          : sections

        return {
          category,
          sections: filtradas,
          totalTopicos: entries.filter(entry => entry.category === category).length,
        }
      })
      .filter(item => item.sections.length > 0)
  }, [busca, grouped, entries])

  const sectionsForSelectedCategory = selectedCategory ? grouped[selectedCategory] : []
  const entriesForSelectedCategory = useMemo(() => (
    selectedCategory
      ? entries.filter(e => e.category === selectedCategory)
      : []
  ), [entries, selectedCategory])

  const groupedEntriesForSelected = useMemo(() => {
    const map = new Map<string, HelpEntry[]>()
    entriesForSelectedCategory.forEach(entry => {
      const arr = map.get(entry.sectionId) ?? []
      arr.push(entry)
      map.set(entry.sectionId, arr)
    })
    map.forEach((arr, key) => {
      map.set(key, [...arr].sort(sortEntries))
    })
    return map
  }, [entriesForSelectedCategory])

  function setRefForEntry(id: string, el: HTMLDivElement | null) {
    accordionRefs.current[id] = el
  }

  function toggleAccordion(entryId: string) {
    const next = expandedEntryId === entryId ? null : entryId
    setExpandedEntryId(next)
    if (next) {
      setTimeout(() => {
        accordionRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }
  }

  function reorderEntries(draggedId: string, targetId: string) {
    if (!draggedId || !targetId || draggedId === targetId) return

    if (!canReorderEntries) return
    setEntries(prev => {
      const dragged = prev.find(item => item.id === draggedId)
      const target = prev.find(item => item.id === targetId)
      if (!dragged || !target) return prev
      if (dragged.sectionId !== target.sectionId) return prev

      const sectionEntries = prev
        .filter(item => item.sectionId === dragged.sectionId)
        .sort(sortEntries)

      const from = sectionEntries.findIndex(item => item.id === draggedId)
      const to = sectionEntries.findIndex(item => item.id === targetId)
      if (from < 0 || to < 0 || from === to) return prev

      const updated = [...sectionEntries]
      const [moved] = updated.splice(from, 1)
      updated.splice(to, 0, moved)

      const newOrder = new Map(updated.map((item, idx) => [item.id, idx + 1]))
      return prev.map(item => {
        const ordem = newOrder.get(item.id)
        return ordem ? { ...item, ordem } : item
      })
    })
  }

  function ensureEditorSelection() {
    const editor = richTextRef.current
    if (!editor) return false

    editor.focus()
    const selection = window.getSelection()
    if (!selection) return false

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const container = range.commonAncestorContainer
      const isInsideEditor = editor.contains(container.nodeType === Node.TEXT_NODE ? container.parentNode : container)
      if (isInsideEditor) return true
    }

    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
    return true
  }

  function handleRichTextCommand(command: string) {
    if (!ensureEditorSelection()) return

    if (command === 'clearFormatting') {
      document.execCommand('removeFormat')
      document.execCommand('unlink')
    } else if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
      const applied = document.execCommand(command)
      if (!applied) {
        const ordered = command === 'insertOrderedList'
        const tag = ordered ? 'ol' : 'ul'
        const selection = window.getSelection()
        const text = selection?.toString().trim() || ''

        if (text) {
          const safe = text
            .split(/\n+/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => line.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch)))
          const html = `<${tag}>${safe.map(line => `<li>${line}</li>`).join('')}</${tag}>`
          document.execCommand('insertHTML', false, html)
        } else {
          document.execCommand('insertHTML', false, `<${tag}><li>Item</li></${tag}><p></p>`)
        }
      }
    } else {
      document.execCommand(command)
    }

    if (richTextRef.current) {
      setForm(prev => ({ ...prev, instrucoesHtml: richTextRef.current?.innerHTML || '' }))
    }
  }

  function captureCurrentSelectionRange(): boolean {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false
    const range = selection.getRangeAt(0)
    const editor = richTextRef.current
    if (!editor) return false

    const container = range.commonAncestorContainer
    const isInsideEditor = editor.contains(container.nodeType === Node.TEXT_NODE ? container.parentNode : container)
    if (!isInsideEditor || range.collapsed) return false

    savedRangeRef.current = range.cloneRange()
    return true
  }

  function restoreSelectionRange() {
    const range = savedRangeRef.current
    if (!range) return false
    const selection = window.getSelection()
    if (!selection) return false
    selection.removeAllRanges()
    selection.addRange(range)
    return true
  }

  function handleRichTextLink() {
    if (!captureCurrentSelectionRange()) {
      toast.error('Selecione um texto dentro do editor para inserir o link')
      return
    }
    setLinkDraft('https://')
    setShowLinkEditor(true)
  }

  function handleApplyLink() {
    const raw = linkDraft.trim()
    if (!raw) {
      toast.error('Informe um link válido')
      return
    }

    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    richTextRef.current?.focus()
    if (!restoreSelectionRange()) {
      toast.error('Seleção inválida. Selecione o texto novamente.')
      return
    }

    document.execCommand('createLink', false, normalized)
    setShowLinkEditor(false)
    setLinkDraft('')
    savedRangeRef.current = null

    if (richTextRef.current) {
      setForm(prev => ({ ...prev, instrucoesHtml: richTextRef.current?.innerHTML || '' }))
    }
  }

  function ensureLinksOpenInNewTab(html: string) {
    if (!html) return html
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      doc.querySelectorAll('a').forEach(anchor => {
        anchor.setAttribute('target', '_blank')
        anchor.setAttribute('rel', 'noopener noreferrer')
      })
      return doc.body.innerHTML
    } catch {
      return html
    }
  }

  function truncateFileName(name: string, maxLength = 26): string {
    if (name.length <= maxLength) return name
    const dot = name.lastIndexOf('.')
    if (dot > 0) {
      const ext = name.slice(dot)
      const base = name.slice(0, dot)
      const available = maxLength - ext.length - 3
      if (available >= 4) {
        const front = Math.ceil(available / 2)
        const back = Math.floor(available / 2)
        return base.slice(0, front) + '...' + base.slice(-back) + ext
      }
    }
    return name.slice(0, maxLength - 3) + '...'
  }

  function compressImage(file: File, maxWidth = 900, quality = 0.75): Promise<string> {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const w = Math.min(img.naturalWidth, maxWidth)
        const h = Math.round(img.naturalHeight * (w / img.naturalWidth))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.readAsDataURL(file)
      }
      img.src = url
    })
  }

  async function fileToData(file: File, options?: { maxWidth?: number; quality?: number }): Promise<MaterialAnexo> {
    const isImage = file.type.startsWith('image/')
    const dataUrl = isImage
      ? await compressImage(file, options?.maxWidth ?? 900, options?.quality ?? 0.75)
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
    return { name: file.name, mime: file.type || 'application/octet-stream', dataUrl }
  }

  async function onPickAnexo(file: File | null) {
    if (!file) return
    const parsed = await fileToData(file)
    setForm(prev => ({ ...prev, anexo: parsed, tituloAnexo: prev.tituloAnexo || parsed.name }))
  }

  function removeAnexo() {
    setPendingAssetRemoval({ type: 'anexo' })
  }

  async function onPickCapa(file: File | null) {
    if (!file) return
    const parsed = await fileToData(file)
    setForm(prev => ({ ...prev, capa: parsed }))
  }

  function removeCapa() {
    setPendingAssetRemoval({ type: 'capa' })
  }

  async function onPickStepMaterial(index: number, file: File | null) {
    if (!file) return
    const parsed = await fileToData(file)
    setForm(prev => {
      const passos = [...prev.passos]
      passos[index] = { ...passos[index], material: parsed }
      return { ...prev, passos }
    })
  }

  function removeStepMaterial(index: number) {
    setPendingAssetRemoval({ type: 'step-material', index })
  }

  async function onPickStepPrint(index: number, file: File | null) {
    if (!file) return
    const parsed = await fileToData(file, { maxWidth: 1920, quality: 0.9 })
    setForm(prev => {
      const passos = [...prev.passos]
      passos[index] = { ...passos[index], print: parsed }
      return { ...prev, passos }
    })
  }

  function removeStepPrint(index: number) {
    setPendingAssetRemoval({ type: 'step-print', index })
  }

  function confirmPendingAssetRemoval() {
    if (!pendingAssetRemoval) return

    if (pendingAssetRemoval.type === 'anexo') {
      setForm(prev => ({ ...prev, anexo: undefined, tituloAnexo: '' }))
      setPendingAssetRemoval(null)
      return
    }

    if (pendingAssetRemoval.type === 'capa') {
      setForm(prev => ({ ...prev, capa: undefined }))
      setPendingAssetRemoval(null)
      return
    }

    setForm(prev => {
      const passos = [...prev.passos]
      const current = passos[pendingAssetRemoval.index]
      if (!current) return prev

      passos[pendingAssetRemoval.index] = pendingAssetRemoval.type === 'step-material'
        ? { ...current, material: undefined }
        : { ...current, print: undefined }

      return { ...prev, passos }
    })

    setPendingAssetRemoval(null)
  }

  function addStep() {
    setForm(prev => ({
      ...prev,
      passos: [
        ...prev.passos,
        {
          id: crypto.randomUUID(),
          titulo: `Siga esse passo ${prev.passos.length + 1}`,
          descricao: '',
        },
      ],
    }))
  }

  function removeStep(index: number) {
    setForm(prev => {
      if (prev.passos.length === 1) return prev
      const passos = [...prev.passos]
      passos.splice(index, 1)
      return { ...prev, passos }
    })
  }

  function updateStep(index: number, patch: Partial<TutorialStep>) {
    setForm(prev => {
      const passos = [...prev.passos]
      passos[index] = { ...passos[index], ...patch }
      return { ...prev, passos }
    })
  }

  function resetForm() {
    pendingEditorHtmlRef.current = ''
    setForm({ ...FORM_EMPTY, passos: [{ id: crypto.randomUUID(), titulo: 'Siga esse passo 1', descricao: '' }] })
    setEditingEntryId(null)
    setEditorInstanceKey(prev => prev + 1)
    setShowLinkEditor(false)
    setLinkDraft('')
    savedRangeRef.current = null
    setSaving(false)
    setSavingProgress(0)
  }

  function openNewEntryModal() {
    if (isConsultor) {
      toast.error('Consultor possui acesso somente leitura na Central de Ajuda')
      return
    }
    resetForm()
    setOpenConteudo(true)
  }

  function openEditEntry(entry: HelpEntry) {
    if (isConsultor) {
      toast.error('Consultor possui acesso somente leitura na Central de Ajuda')
      return
    }
    const normalizedHtml = entry.instrucoesHtml || ''
    pendingEditorHtmlRef.current = normalizedHtml
    setEditingEntryId(entry.id)
    setShowLinkEditor(false)
    setLinkDraft('')
    savedRangeRef.current = null
    setForm({
      sectionId: entry.sectionId,
      titulo: entry.titulo,
      instrucoesHtml: normalizedHtml,
      anexo: entry.anexo,
      tituloAnexo: entry.tituloAnexo || '',
      capa: entry.capa,
      videoLink: entry.videoLink || '',
      tutorialPasso: entry.tutorialPasso,
      passos: entry.passos.length > 0
        ? entry.passos.map(step => ({ ...step }))
        : [{ id: crypto.randomUUID(), titulo: 'Siga esse passo 1', descricao: '' }],
    })
    setEditorInstanceKey(prev => prev + 1)
    setOpenConteudo(true)
  }

  function getSectionLabel(sectionId: string) {
    return HELP_SECTIONS.find(section => section.id === sectionId)?.label || 'Sessão não identificada'
  }

  function getPlainTextFromHtml(html: string) {
    if (!html) return ''
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      return doc.body.textContent?.trim() || ''
    } catch {
      return html.replace(/<[^>]+>/g, ' ').trim()
    }
  }

  function getEntryPreview(entry: HelpEntry) {
    const text = getPlainTextFromHtml(entry.instrucoesHtml)
    if (!text) return 'Sem texto complementar cadastrado.'
    return text.length > 140 ? `${text.slice(0, 140).trim()}...` : text
  }

  async function handleSaveEntry() {
    if (isConsultor) {
      toast.error('Consultor possui acesso somente leitura na Central de Ajuda')
      return
    }
    if (!form.sectionId) {
      toast.error('Selecione a sessão/categoria')
      return
    }
    if (!form.titulo.trim()) {
      toast.error('Informe o título do tutorial ou material')
      return
    }

    const section = HELP_SECTIONS.find(s => s.id === form.sectionId)
    if (!section) {
      toast.error('Sessão inválida')
      return
    }

    const currentEntry = editingEntryId ? entries.find(entry => entry.id === editingEntryId) : null

    setSaving(true)
    setSavingProgress(10)

    await new Promise<void>(resolve => {
      const timer = setInterval(() => {
        setSavingProgress(prev => {
          if (prev >= 95) {
            clearInterval(timer)
            resolve()
            return 95
          }
          return prev + 15
        })
      }, 120)
    })

    const salvo: HelpEntry = {
      id: editingEntryId || crypto.randomUUID(),
      sectionId: form.sectionId,
      category: section.category,
      ordem: (() => {
        if (currentEntry && currentEntry.sectionId === form.sectionId) {
          return currentEntry.ordem
        }
        const maiorOrdem = entries
          .filter(entry => entry.sectionId === form.sectionId && entry.id !== editingEntryId)
          .reduce((acc, entry) => Math.max(acc, entry.ordem ?? 0), 0)
        return maiorOrdem + 1
      })(),
      titulo: form.titulo,
      instrucoesHtml: ensureLinksOpenInNewTab(form.instrucoesHtml),
      anexo: form.anexo,
      tituloAnexo: form.tituloAnexo,
      capa: form.capa,
      videoLink: form.videoLink,
      tutorialPasso: form.tutorialPasso,
      passos: form.tutorialPasso ? form.passos : [],
      createdAt: currentEntry?.createdAt || new Date().toISOString(),
    }

    setEntries(prev => normalizeEntriesOrder(
      editingEntryId
        ? prev.map(entry => (entry.id === editingEntryId ? salvo : entry))
        : [...prev, salvo],
    ))
    setSavingProgress(100)

    setTimeout(() => {
      setOpenConteudo(false)
      setSelectedCategory(section.category)
      setExpandedEntryId(salvo.id)
      toast.success(editingEntryId ? 'Conteúdo atualizado com sucesso!' : 'Conteúdo criado com sucesso!')
      resetForm()
      setTimeout(() => {
        accordionRefs.current[salvo.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 180)
    }, 180)
  }

  function confirmDeleteEntry() {
    if (isConsultor) {
      toast.error('Consultor possui acesso somente leitura na Central de Ajuda')
      setDeleteTarget(null)
      return
    }
    if (!deleteTarget) return
    setEntries(prev => normalizeEntriesOrder(prev.filter(entry => entry.id !== deleteTarget.id)))
    if (expandedEntryId === deleteTarget.id) setExpandedEntryId(null)
    setDeleteTarget(null)
    toast.success('Conteúdo removido')
  }

  function getAttachmentMeta(anexo?: MaterialAnexo) {
    if (!anexo) return null
    const mime = anexo.mime.toLowerCase()
    if (mime.includes('pdf')) return { label: 'Baixar PDF', color: 'bg-[#dc3545]', icon: FileArchive }
    if (mime.includes('sheet') || mime.includes('excel') || anexo.name.toLowerCase().endsWith('.xlsx')) return { label: 'Baixar Planilha', color: 'bg-[#198754]', icon: FileSpreadsheet }
    if (mime.includes('image')) return { label: 'Baixar Imagem', color: 'bg-[#6f42c1]', icon: ImageIcon }
    return { label: 'Baixar Arquivo', color: 'bg-[#0d6efd]', icon: FileText }
  }

  function getEmbedVideoUrl(link?: string) {
    if (!link) return null

    if (link.includes('youtube.com/watch?v=')) {
      const id = link.split('v=')[1]?.split('&')[0]
      if (id) return `https://www.youtube.com/embed/${id}`
    }
    if (link.includes('youtu.be/')) {
      const id = link.split('youtu.be/')[1]?.split('?')[0]
      if (id) return `https://www.youtube.com/embed/${id}`
    }
    if (link.includes('drive.google.com/file/d/')) {
      const id = link.split('/file/d/')[1]?.split('/')[0]
      if (id) return `https://drive.google.com/file/d/${id}/preview`
    }
    return null
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-[#f45a06] via-[#f96812] to-[#ff8a3d] p-8 text-white shadow-sm">
        <h1 className="text-4xl font-black tracking-tight text-center">Central de Ajuda & Materiais</h1>
        <p className="mt-2 text-center text-white/90">Acesse tutoriais e baixe materiais de apoio oficiais</p>
        <div className="mx-auto mt-6 max-w-3xl rounded-full bg-white p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Busque por categoria, sessão, material ou palavra-chave..."
              className="h-12 rounded-full border-0 bg-transparent pl-12 text-base text-foreground shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      </section>

      {!isConsultor && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon" onClick={() => setOpenEstrutura(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={openNewEntryModal}
            className={cn(buttonVariants({ variant: 'default' }), 'rounded-full bg-[#1f8f58] hover:bg-[#187a4b]')}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo Conteúdo/Material
          </button>
        </div>
      )}

      {!selectedCategory ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {cards.map(({ category, sections, totalTopicos }) => {
            const Icon = categoryIconMap[category]
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className="text-left"
              >
                <Card className="border border-black/5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#fff3eb] text-[#f45a06]">
                      <Icon className="h-7 w-7" />
                    </span>
                    <h3 className="text-3xl font-black tracking-tight uppercase">{category}</h3>
                    <p className="text-sm text-muted-foreground">{totalTopicos} tutoriais disponíveis</p>
                    <p className="text-xs text-muted-foreground">{sections.length} sessão(ões)</p>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </section>
      ) : (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory(null)
              setExpandedEntryId(null)
            }}
            className="inline-flex items-center gap-2 text-xl text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para categorias
          </button>

          <h2 className="text-5xl font-black tracking-tight text-[#f45a06] uppercase">{selectedCategory}</h2>

          {entriesForSelectedCategory.length === 0 ? (
            <div className="py-16 text-center text-xl text-muted-foreground">Nenhuma dúvida ativa nesta categoria.</div>
          ) : (
            <div className="space-y-2">
              {sectionsForSelectedCategory.map(section => {
                const list = groupedEntriesForSelected.get(section.id) ?? []
                if (list.length === 0) return null
                return (
                  <div key={section.id} className="space-y-2">
                    <div className="text-sm font-bold uppercase text-muted-foreground">{section.label}</div>
                    {list.map(entry => {
                      const open = expandedEntryId === entry.id
                      const meta = getAttachmentMeta(entry.anexo)
                      const embedUrl = getEmbedVideoUrl(entry.videoLink)

                      return (
                        <div
                          key={entry.id}
                          ref={el => setRefForEntry(entry.id, el)}
                          onDragOver={event => {
                            if (!canReorderEntries) return
                            event.preventDefault()
                            if (draggingEntryId && draggingEntryId !== entry.id) {
                              setDragOverEntryId(entry.id)
                            }
                          }}
                          onDrop={event => {
                            if (!canReorderEntries) return
                            event.preventDefault()
                            if (draggingEntryId && draggingEntryId !== entry.id) {
                              reorderEntries(draggingEntryId, entry.id)
                              toast.success('Ordem atualizada')
                            }
                            setDraggingEntryId(null)
                            setDragOverEntryId(null)
                          }}
                          onDragLeave={() => {
                            if (!canReorderEntries) return
                            if (dragOverEntryId === entry.id) setDragOverEntryId(null)
                          }}
                          className={cn(
                            'overflow-hidden rounded-xl border border-black/10 bg-card scroll-mt-20 transition-all duration-200',
                            open && 'border-[#f25c05]/50 dark:border-orange-500/40',
                            draggingEntryId === entry.id && 'opacity-60',
                            dragOverEntryId === entry.id && 'border-[#f45a06] ring-2 ring-[#f45a06]/20',
                          )}
                        >
                          <div className={cn('flex items-center justify-between border-b px-4 py-3 transition-all duration-200', open ? 'bg-orange-50/70 dark:bg-orange-950/50' : 'bg-muted hover:bg-orange-50/70 dark:hover:bg-orange-950/20')}>
                            {canReorderEntries ? (
                              <div
                                draggable
                                onDragStart={event => {
                                  setDraggingEntryId(entry.id)
                                  event.dataTransfer.effectAllowed = 'move'
                                  event.dataTransfer.setData('text/plain', entry.id)
                                }}
                                onDragEnd={() => {
                                  setDraggingEntryId(null)
                                  setDragOverEntryId(null)
                                }}
                                className="mr-2 cursor-grab rounded p-1 text-[#4f6b8a] hover:bg-white/60 active:cursor-grabbing"
                                title="Arrastar para reordenar"
                                aria-label="Arrastar para reordenar"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => toggleAccordion(entry.id)}
                              className="flex flex-1 items-center justify-between text-left"
                            >
                              <span className="text-lg font-bold">{entry.titulo}</span>
                              {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </button>
                            {!isConsultor && (
                              <div className="ml-3 flex items-center gap-2 text-[#ef8b62]">
                                <button type="button" title="Editar" className="hover:text-[#f45a06]" onClick={() => openEditEntry(entry)}>
                                  <PenSquare className="h-5 w-5" />
                                </button>
                                <button type="button" title="Excluir" className="hover:text-[#dc3545]" onClick={() => setDeleteTarget(entry)}>
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {open && (
                            <div className="space-y-4 p-4">
                              {entry.capa && entry.capa.mime.includes('image') && (
                                <div className="rounded-xl border bg-muted/30 p-2">
                                  <img src={entry.capa.dataUrl} alt={entry.titulo} className="mx-auto max-h-[360px] rounded-lg object-contain" />
                                </div>
                              )}

                              {entry.instrucoesHtml && (
                                <div
                                  className="prose max-w-none text-foreground [&_a]:text-[#0d6efd] [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1"
                                  dangerouslySetInnerHTML={{ __html: ensureLinksOpenInNewTab(entry.instrucoesHtml) }}
                                />
                              )}

                              {entry.tutorialPasso && entry.passos.length > 0 && (
                                <div className="rounded-lg border bg-background p-4">
                                  <p className="mb-5 flex items-center gap-2 text-base font-bold text-[#f45a06]">
                                    <ListOrdered className="h-5 w-5" /> Tutorial Passo a Passo:
                                  </p>
                                  <div>
                                    {entry.passos.map((step, idx) => (
                                      <div key={step.id} className="flex gap-4">
                                        {/* Coluna esquerda: círculo + linha vertical */}
                                        <div className="flex flex-col items-center">
                                          <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f45a06] text-sm font-bold text-white shadow-sm">
                                            {idx + 1}
                                          </span>
                                          {idx < entry.passos.length - 1 && (
                                            <div className="my-1 flex-1 w-0.5 min-h-[20px] bg-[#f45a06]/30" />
                                          )}
                                        </div>
                                        {/* Coluna direita: conteúdo */}
                                        <div className={cn('min-w-0 flex-1', idx < entry.passos.length - 1 ? 'pb-6' : 'pb-1')}>
                                          <p className="text-xl font-bold leading-tight">{step.titulo}</p>
                                          {step.descricao && <p className="mt-1 text-muted-foreground whitespace-pre-line">{step.descricao}</p>}

                                          {step.print && step.print.mime.includes('image') && (
                                            <button type="button" className="mt-3 block" onClick={() => setOpenLightbox(step.print || null)}>
                                              <img src={step.print.dataUrl} alt={step.titulo} className="max-h-48 rounded-lg border object-contain" />
                                            </button>
                                          )}

                                          {step.material && (
                                            <a
                                              href={step.material.dataUrl}
                                              download={step.material.name}
                                              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#f45a06] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                                            >
                                              <Download className="h-3 w-3" /> Acessar Material do Passo
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {entry.anexo && meta && (
                                <div className="rounded-xl border bg-muted/30 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                                        <meta.icon className="h-5 w-5" />
                                      </span>
                                      <div>
                                        <p className="font-bold">{entry.tituloAnexo || entry.anexo.name}</p>
                                        <p className="text-xs text-muted-foreground">Clique ao lado para acessar</p>
                                      </div>
                                    </div>
                                    <a
                                      href={entry.anexo.dataUrl}
                                      download={entry.anexo.name}
                                      className={cn('inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-white', meta.color)}
                                    >
                                      <Download className="h-4 w-4" /> {meta.label}
                                    </a>
                                  </div>

                                  {entry.anexo.mime.includes('image') && (
                                    <button type="button" className="mt-3 block w-full" onClick={() => setOpenLightbox(entry.anexo || null)}>
                                      <img src={entry.anexo.dataUrl} alt={entry.anexo.name} className="mx-auto max-h-[320px] rounded-lg border object-contain" />
                                    </button>
                                  )}
                                </div>
                              )}

                              {embedUrl && (
                                <div className="overflow-hidden rounded-xl border">
                                  <iframe
                                    title={`video-${entry.id}`}
                                    src={embedUrl}
                                    className="h-[380px] w-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      <Dialog open={openEstrutura} onOpenChange={setOpenEstrutura}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-[#f45a06] px-5 py-4 text-white">
            <DialogTitle className="flex items-center gap-2 text-3xl font-black tracking-tight text-white">
              <PenSquare className="h-5 w-5" /> Estrutura da Ajuda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <Card>
              <CardContent className="space-y-3 py-4">
                <h4 className="text-xl font-bold text-muted-foreground">Adicionar Nova Sessão</h4>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Categoria (Ex: REDES SOCIAIS)</p>
                  <Input placeholder="Digite ou selecione..." />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Nome da Sessão (Ex: INSTAGRAM)</p>
                  <Input placeholder="Digite o nome da sessão..." />
                </div>
                <Button className="w-full"><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-2xl font-bold text-muted-foreground">Estrutura Atual</h4>
                <span className="text-xs text-muted-foreground">(Agrupado por Categoria)</span>
              </div>

              <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
                {HELP_CATEGORY_ORDER.map(category => {
                  const sections = grouped[category]
                  if (sections.length === 0) return null
                  const open = expandedCategory === category
                  return (
                    <div key={category} className="rounded-xl border bg-card">
                      <button
                        type="button"
                        onClick={() => setExpandedCategory(open ? null : category)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left"
                      >
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <Folder className="h-4 w-4 text-[#f2b705]" /> {category}
                          <span className="rounded-full bg-muted px-2 text-xs">{sections.length}</span>
                        </span>
                        <PenSquare className="h-4 w-4 text-[#f45a06]" />
                      </button>
                      {open && (
                        <div className="space-y-1 border-t bg-muted/30 px-3 py-2">
                          {sections.map(section => (
                            <RowSection key={section.id} section={section} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openConteudo}
        onOpenChange={open => {
          setOpenConteudo(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[95vw] md:max-w-[1100px] lg:max-w-[1200px] max-h-[94vh] overflow-hidden p-0">
          <DialogHeader className="bg-[#f45a06] px-5 py-4 text-white">
            <DialogTitle className="flex items-center gap-2 text-2xl font-black tracking-tight text-white">
              <PenSquare className="h-5 w-5" /> {editingEntryId ? 'Editar Conteúdo' : 'Gerenciar Conteúdo'}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(94vh-76px)] overflow-y-auto p-4 md:p-5">
            <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
              <div className="space-y-4 lg:col-span-7">
                <div className="space-y-2">
              <p className="text-sm font-bold">Sessão / Categoria</p>
              <select
                value={form.sectionId}
                onChange={e => setForm(prev => ({ ...prev, sectionId: e.target.value }))}
                className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
              >
                <option value="">Selecione a sessão...</option>
                {HELP_CATEGORY_ORDER.map(category => (
                  <optgroup key={category} label={category}>
                    {grouped[category].map(section => (
                      <option key={section.id} value={section.id}>{section.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
                </div>

                <div className="space-y-2">
              <p className="text-sm font-bold">Título do Tutorial ou Material</p>
              <Input
                value={form.titulo}
                onChange={e => setForm(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Ex: Treino 5km - Planilha Iniciante"
              />
                </div>

                <div className="space-y-2">
              <p className="text-sm font-bold">Instruções de Uso (Opcional)</p>
              <div className="rounded-lg border">
                <div className="flex items-center gap-1 border-b bg-muted/40 p-2">
                  <button title="Negrito" type="button" className="rounded p-1 hover:bg-background" onMouseDown={e => e.preventDefault()} onClick={() => handleRichTextCommand('bold')}><Bold className="h-4 w-4" /></button>
                  <button title="Itálico" type="button" className="rounded p-1 hover:bg-background" onMouseDown={e => e.preventDefault()} onClick={() => handleRichTextCommand('italic')}><Italic className="h-4 w-4" /></button>
                  <button title="Sublinhado" type="button" className="rounded p-1 hover:bg-background" onMouseDown={e => e.preventDefault()} onClick={() => handleRichTextCommand('underline')}><Underline className="h-4 w-4" /></button>
                  <button title="Lista com marcadores" type="button" className="rounded p-1 hover:bg-background" onMouseDown={e => e.preventDefault()} onClick={() => handleRichTextCommand('insertUnorderedList')}><List className="h-4 w-4" /></button>
                  <button title="Lista numerada" type="button" className="rounded p-1 hover:bg-background" onMouseDown={e => e.preventDefault()} onClick={() => handleRichTextCommand('insertOrderedList')}><ListOrdered className="h-4 w-4" /></button>
                  <button title="Inserir link" type="button" className="rounded p-1 hover:bg-background" onMouseDown={e => e.preventDefault()} onClick={handleRichTextLink}><LinkIcon className="h-4 w-4" /></button>
                  <button title="Limpar formatação" type="button" className="rounded p-1 hover:bg-background" onMouseDown={e => e.preventDefault()} onClick={() => handleRichTextCommand('clearFormatting')}>
                    <span className="text-xs font-bold">Tx</span>
                  </button>
                </div>
                {showLinkEditor && (
                  <div className="flex items-center gap-2 border-b bg-background p-2">
                    <span className="text-sm text-muted-foreground">Enter link:</span>
                    <Input
                      ref={linkInputRef}
                      value={linkDraft}
                      onChange={e => setLinkDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleApplyLink()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setShowLinkEditor(false)
                        }
                      }}
                      placeholder="https://..."
                      className="h-9"
                    />
                    <button
                      type="button"
                      className="rounded-md px-3 py-1.5 text-sm font-semibold text-[#0d6efd] hover:bg-muted"
                      onMouseDown={e => e.preventDefault()}
                      onClick={handleApplyLink}
                    >
                      Save
                    </button>
                  </div>
                )}
                <div
                  key={editorInstanceKey}
                  ref={setRichTextElement}
                  contentEditable
                  onInput={() => setForm(prev => ({ ...prev, instrucoesHtml: richTextRef.current?.innerHTML || '' }))}
                  className="min-h-[140px] p-3 text-sm outline-none [&_a]:text-[#0d6efd] [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1"
                  data-placeholder="Escreva o tutorial aqui..."
                  suppressContentEditableWarning
                />
              </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-bold">Link do YouTube ou Drive</p>
                  <Input value={form.videoLink} onChange={e => setForm(prev => ({ ...prev, videoLink: e.target.value }))} placeholder="Cole o link aqui..." />
                </div>
              </div>

              <div className="space-y-4 lg:col-span-5 lg:sticky lg:top-2 lg:self-start">

                <div className="space-y-3 rounded-xl border border-dashed p-3 md:p-4">
              <p className="text-sm font-bold inline-flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-[#f45a06]" /> Anexar Material (PDF, Excel ou Imagem)
              </p>
              <label htmlFor="anexo-material" className="block cursor-pointer rounded-xl border border-dashed bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50">
                <UploadCloud className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-base font-semibold text-muted-foreground">Clique para fazer upload do arquivo</p>
                <p className="mt-1 text-xs text-muted-foreground">Suporta: PDF, DOCX, XLSX, PNG, JPG</p>
              </label>
              <input
                id="anexo-material"
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={e => onPickAnexo(e.target.files?.[0] || null)}
              />
              {form.anexo && (
                <div className="inline-flex items-center gap-2 rounded-lg bg-[#e8f7ee] px-3 py-1 text-sm font-semibold text-[#198754]">
                  <Check className="h-4 w-4" />
                  <span>{truncateFileName(form.anexo.name)}</span>
                  <button
                    type="button"
                    onClick={removeAnexo}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#dc3545] hover:bg-[#fbe8e8]"
                    title="Remover anexo"
                    aria-label="Remover anexo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <Input
                value={form.tituloAnexo}
                onChange={e => setForm(prev => ({ ...prev, tituloAnexo: e.target.value }))}
                placeholder="Título do anexo (o que aparecerá no card)"
              />
                </div>

                <div className="space-y-3 rounded-xl border-l-4 border-l-[#f45a06] border p-3">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={form.tutorialPasso}
                  onChange={e => setForm(prev => ({ ...prev, tutorialPasso: e.target.checked }))}
                />
                Habilitar Tutorial Passo-a-Passo
              </label>

              {form.tutorialPasso && (
                <div className="space-y-3">
                  {form.passos.map((step, index) => (
                    <div key={step.id} className="rounded-lg border bg-background p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">Passo {index + 1}</span>
                        <button type="button" onClick={() => removeStep(index)} className="text-[#dc3545] hover:opacity-80"><X className="h-4 w-4" /></button>
                      </div>

                      <div className="space-y-2">
                        <Input value={step.titulo} onChange={e => updateStep(index, { titulo: e.target.value })} />
                        <textarea
                          value={step.descricao}
                          onChange={e => updateStep(index, { descricao: e.target.value })}
                          className="min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm"
                          placeholder={`Aqui você vai colocar o texto que explica o passo ${index + 1}.`}
                        />

                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <div className="rounded-lg border p-2">
                            <p className="text-sm font-bold mb-1">Material do Passo:</p>
                            <label htmlFor={`step-material-${index}`} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40">
                              <UploadCloud className="h-4 w-4" /> Escolher arquivo
                            </label>
                            <input id={`step-material-${index}`} type="file" className="hidden" onChange={e => onPickStepMaterial(index, e.target.files?.[0] || null)} />
                            {step.material && (
                              <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1">
                                <p className="text-xs text-muted-foreground">{truncateFileName(step.material.name)}</p>
                                <button
                                  type="button"
                                  onClick={() => removeStepMaterial(index)}
                                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#dc3545] hover:bg-[#fbe8e8]"
                                  title="Remover material do passo"
                                  aria-label="Remover material do passo"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="rounded-lg border border-dashed p-2">
                            <p className="text-sm font-bold mb-1"><Camera className="mr-1 inline h-4 w-4" /> Anexar Print</p>
                            <label htmlFor={`step-print-${index}`} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40">
                              <UploadCloud className="h-4 w-4" /> Anexar print
                            </label>
                            <input id={`step-print-${index}`} type="file" className="hidden" accept="image/*" onChange={e => onPickStepPrint(index, e.target.files?.[0] || null)} />
                            {step.print && (
                              <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1">
                                <p className="text-xs text-muted-foreground">{truncateFileName(step.print.name)}</p>
                                <button
                                  type="button"
                                  onClick={() => removeStepPrint(index)}
                                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#dc3545] hover:bg-[#fbe8e8]"
                                  title="Remover print do passo"
                                  aria-label="Remover print do passo"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button type="button" onClick={addStep} className="w-full rounded-lg border px-3 py-2 font-bold text-[#f45a06] hover:bg-[#fff2ea]">
                    <Plus className="mr-1 inline h-4 w-4" /> Adicionar Novo Passo
                  </button>
                </div>
              )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-bold">Foto de Capa (Opcional)</p>
                  <label htmlFor="foto-capa" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40">
                    <UploadCloud className="h-4 w-4" /> Escolher arquivo
                  </label>
                  <input id="foto-capa" className="hidden" type="file" accept="image/*" onChange={e => onPickCapa(e.target.files?.[0] || null)} />
                  {form.capa && (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1">
                      <p className="text-xs text-muted-foreground">{truncateFileName(form.capa.name)}</p>
                      <button
                        type="button"
                        onClick={removeCapa}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#dc3545] hover:bg-[#fbe8e8]"
                        title="Remover foto de capa"
                        aria-label="Remover foto de capa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {saving && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>Finalizando no banco de dados...</span>
                      <span>{savingProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-[#f45a06] transition-all" style={{ width: `${savingProgress}%` }} />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveEntry}
                  className={cn(
                    'w-full rounded-2xl bg-gradient-to-r from-[#f45a06] to-[#ff8a3d] py-4 text-lg font-black text-white transition-opacity',
                    saving && 'opacity-70'
                  )}
                >
                  {saving ? 'Salvando...' : editingEntryId ? 'Salvar Alterações' : 'Salvar e Publicar'}
                </button>
              </div>
                </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Confirmar exclusão"
        description="Revise abaixo o conteúdo selecionado antes de confirmar a exclusão."
        confirmLabel="Confirmar exclusão"
        destructive
        onConfirm={confirmDeleteEntry}
      >
        {deleteTarget && (
          <div className="space-y-3 rounded-xl border border-[#f3d7c5] bg-[#fff8f4] p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pergunta</p>
              <p className="mt-1 text-lg font-bold text-foreground">{deleteTarget.titulo}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Categoria</p>
                <p className="mt-1 font-semibold text-foreground">{deleteTarget.category}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sessão</p>
                <p className="mt-1 font-semibold text-foreground">{getSectionLabel(deleteTarget.sectionId)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Prévia do conteúdo</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{getEntryPreview(deleteTarget)}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1eb] px-3 py-1 text-sm font-semibold text-[#d9480f]">
              <TriangleAlert className="h-4 w-4" /> Essa ação apagará este conteúdo da Central de Ajuda.
            </div>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!pendingAssetRemoval}
        onOpenChange={open => !open && setPendingAssetRemoval(null)}
        title="Remover arquivo anexado"
        description={pendingAssetRemoval?.type === 'anexo'
          ? 'Deseja remover o anexo principal deste conteúdo?'
          : pendingAssetRemoval?.type === 'capa'
            ? 'Deseja remover a foto de capa deste conteúdo?'
            : pendingAssetRemoval?.type === 'step-material'
              ? 'Deseja remover o material anexado deste passo?'
              : 'Deseja remover o print anexado deste passo?'}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        destructive
        onConfirm={confirmPendingAssetRemoval}
      />

      <Dialog open={!!openLightbox} onOpenChange={open => !open && setOpenLightbox(null)}>
        <DialogContent className="left-1/2 top-1/2 flex h-[100vh] w-[100vw] max-w-none sm:max-w-none -translate-x-1/2 -translate-y-1/2 items-center justify-center border-0 bg-black/72 p-6 ring-0 shadow-none" showCloseButton={false}>
          <button
            type="button"
            onClick={() => setOpenLightbox(null)}
            className="absolute right-3 top-3 z-10 rounded-full bg-black/65 p-2 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          {openLightbox && (
            <div className="flex h-full w-full items-center justify-center overflow-auto">
              <img src={openLightbox.dataUrl} alt={openLightbox.name} className="max-h-[94vh] max-w-[96vw] h-auto w-auto rounded-xl border border-white/10 bg-white/5 object-contain shadow-2xl" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RowSection({ section }: { section: (typeof HELP_SECTIONS)[number] }) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-background">
      <span className="text-muted-foreground">↳ {section.label}</span>
      <span className="flex items-center gap-2 text-[#f45a06]">
        <PenSquare className="h-4 w-4" />
      </span>
    </div>
  )
}
