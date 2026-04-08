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
    instrucoesHtml: '<p>Os filtros ajudam a recortar o trabalho por prioridade operacional:</p><ul><li>Prazo: atrasadas, hoje e próximos dias.</li><li>Status: abertas, concluídas, reagendadas e canceladas.</li><li>Prioridade: normal, alta e urgente.</li><li>Consultor: por responsável.</li><li>Somente minhas: foco no usuário logado.</li></ul>',
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
    instrucoesHtml: '<p>Os cards de pendência mostram volume operacional (abertas, hoje, atraso e semana). Já os cards de métricas mostram desempenho de interação (interações, contatos realizados, convertidos e taxa).</p><p>É normal existir interação no período e fila vazia, quando não há pendências abertas no momento.</p>',
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
          titulo: 'Como usar o Dashboard como painel de decisão diária?',
          instrucoesHtml: '<p>O Dashboard deve ser usado como painel executivo da operação: ele consolida vendas confirmadas, pipeline, comissões, ocupação e alertas críticos em uma única leitura.</p><p>Antes de abrir outros módulos, valide os indicadores principais e identifique onde existe maior risco ou oportunidade no período.</p>',
        },
        {
          titulo: 'Como interpretar os cards principais (topo) corretamente?',
          instrucoesHtml: '<p>Os cards superiores mostram o termômetro do período selecionado (mês/ano):</p><ul><li><strong>Vendas Confirmadas:</strong> soma apenas contratos com status confirmado.</li><li><strong>Pipeline:</strong> oportunidades em negociação.</li><li><strong>Comissões:</strong> valor devido ou previsto para o perfil logado.</li><li><strong>KM Contratados:</strong> volume operacional contratado no período.</li><li><strong>Perdidos/Expirados:</strong> contratos cancelados ou expirados no recorte.</li></ul><p>Leia os cards sempre junto do filtro de período para evitar comparação incorreta.</p>',
        },
        {
          titulo: 'Como ler Meta Mensal, Tendência 6 meses e Performance da equipe?',
          instrucoesHtml: '<p>A camada analítica do Dashboard tem três leituras:</p><ul><li><strong>Meta Mensal:</strong> compara realizado x meta e aplica semáforo (vermelho, amarelo, verde).</li><li><strong>Tendência 6 meses:</strong> barras em MM/AAAA mostram evolução de faturamento e volume de contratos por mês.</li><li><strong>Performance de consultores:</strong> compara orçamentos criados versus vendas confirmadas por responsável.</li></ul><p>Use esses blocos para entender evolução, gargalos de conversão e prioridades comerciais.</p>',
        },
        {
          titulo: 'Como interpretar Próximos Eventos e Alertas do Período?',
          instrucoesHtml: '<p><strong>Próximos Eventos</strong> prioriza a agenda operacional por proximidade de data e ocupação. Eventos com baixa ocupação e data próxima exigem ação imediata.</p><p><strong>Alertas do Período</strong> resume volume ativo, participantes captados, ocupação média e eventos em risco (até 15 dias e abaixo de 50% de ocupação).</p><p>Trate esses blocos como radar de risco operacional do dia.</p>',
        },
        {
          titulo: 'Quando sair do Dashboard e abrir outro módulo?',
          instrucoesHtml: '<p>Abra o módulo de execução assim que identificar a frente principal:</p><ul><li><strong>Pipeline:</strong> para avançar oportunidades.</li><li><strong>CRM:</strong> para follow-up e relacionamento.</li><li><strong>Gestão do Evento:</strong> para operação detalhada.</li><li><strong>Agenda:</strong> para leitura de calendário e janelas críticas.</li><li><strong>Comissões:</strong> para validação financeira.</li></ul><p>Regra prática: o Dashboard aponta onde agir; a execução acontece na tela especializada.</p>',
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
          titulo: 'Como começar um novo orçamento no sistema?',
          instrucoesHtml: '<p>Comece preenchendo os dados do cliente e do evento. Depois avance para o escopo, escolhendo os itens e quantidades que formarão a proposta.</p><p>A regra prática é montar primeiro a base do evento e só depois refinar valores, estrutura e observações comerciais.</p>',
          tutorialPasso: true,
          passos: [
            { id: 'seed-orcamentos-01-p1', titulo: 'Preencher dados iniciais', descricao: 'Informe cliente, nome do evento, cidade, datas e demais dados básicos.' },
            { id: 'seed-orcamentos-01-p2', titulo: 'Montar o escopo', descricao: 'Adicione os itens necessários para a operação e ajuste quantidades e valores.' },
            { id: 'seed-orcamentos-01-p3', titulo: 'Revisar regras e totais', descricao: 'Confira automações, perfil, observações e o total consolidado.' },
            { id: 'seed-orcamentos-01-p4', titulo: 'Gerar a saída final', descricao: 'Salve e gere o PDF quando a estrutura estiver pronta para apresentação.' },
          ],
        },
        {
          titulo: 'Como funciona o Escopo do Orçamento?',
          instrucoesHtml: '<p>O Escopo do Orçamento é a lista operacional dos itens que compõem a proposta. Cada linha representa um serviço, material ou recurso necessário para atender o evento.</p><p>Revise sempre quantidade, unidade, valor e observações. O escopo bem montado evita erro de preço e de operação.</p>',
        },
        {
          titulo: 'Quando gerar PDF e quando continuar editando o orçamento?',
          instrucoesHtml: '<p>Gere o PDF quando os dados do cliente, escopo e totais estiverem consistentes para apresentação comercial.</p><p>Se ainda faltar validação interna, negociação de preço ou ajuste operacional, continue editando antes de consolidar a versão final.</p>',
        },
      ],
    },
    {
      sectionId: 'historico-propostas',
      entries: [
        {
          titulo: 'O que fica registrado no Histórico de Propostas?',
          instrucoesHtml: '<p>Essa tela reúne as propostas já geradas no sistema, com data de criação, cliente, evento, valor, status e acesso ao PDF.</p><p>Ela funciona como repositório de consulta para recuperar versões já apresentadas e revisar o andamento comercial.</p>',
        },
        {
          titulo: 'Como localizar uma proposta antiga rapidamente?',
          instrucoesHtml: '<p>Use os filtros e a busca da página para localizar por cliente, evento, data ou status. Quanto melhor o cadastro do evento, mais fácil será achar a proposta depois.</p><p>Esse histórico é especialmente útil em renegociações e reenvios.</p>',
        },
        {
          titulo: 'Quando abrir o PDF direto pelo histórico?',
          instrucoesHtml: '<p>Abra o PDF pelo histórico quando precisar revisar exatamente a versão que foi gerada, apresentada ou compartilhada com o cliente.</p><p>Isso evita divergência entre o orçamento em edição e a proposta oficialmente emitida.</p>',
        },
      ],
    },
    {
      sectionId: 'gestao-evento',
      entries: [
        {
          titulo: 'Para que serve a Gestão do Evento?',
          instrucoesHtml: '<p>A Gestão do Evento concentra a execução operacional após a entrada do contrato ou orçamento aprovado. É onde a equipe acompanha dados do evento, participantes, alocações e pendências práticas.</p><p>Use esse módulo para operar o evento, não apenas para consulta.</p>',
        },
        {
          titulo: 'Como funciona a lista de participantes dentro do evento?',
          instrucoesHtml: '<p>A lista de participantes permite acompanhar quem está vinculado ao evento, seus dados cadastrais, status e informações relevantes para a operação.</p><p>Antes de cada ação importante, confirme se os registros estão completos e atualizados para evitar erro de comunicação ou execução.</p>',
        },
        {
          titulo: 'Quando editar dados do evento e quando apenas consultar?',
          instrucoesHtml: '<p>Edite quando houver alteração real de operação, equipe, participantes ou estrutura. Consulte apenas quando o objetivo for validar informações sem mudar o planejamento.</p><p>Separar consulta de edição reduz erro operacional em eventos próximos da execução.</p>',
        },
      ],
    },
    {
      sectionId: 'historico',
      entries: [
        {
          titulo: 'O que mostra a tela Histórico & Inteligência?',
          instrucoesHtml: '<p>Essa área cruza dados históricos de eventos, leads e participantes para apoiar análise e tomada de decisão.</p><p>Ela é útil para consulta estratégica, revisão de comportamento e apoio comercial ou operacional, especialmente em contas recorrentes.</p>',
        },
        {
          titulo: 'Como usar os filtros dessa tela para analisar melhor os dados?',
          instrucoesHtml: '<p>Comece filtrando por evento, período, empresa ou perfil de participante. Depois refine a busca conforme a dúvida de negócio.</p><p>Evite olhar o volume total sem recorte. A leitura fica mais útil quando o filtro responde a uma pergunta objetiva.</p>',
        },
        {
          titulo: 'Quando abrir a ficha completa de um participante?',
          instrucoesHtml: '<p>Abra a ficha completa quando precisar validar histórico individual, dados de contato, participação anterior ou comportamento em eventos já realizados.</p><p>Esse detalhe ajuda tanto a operação quanto a leitura comercial de relacionamento.</p>',
        },
      ],
    },
    {
      sectionId: 'insumos',
      entries: [
        {
          titulo: 'Como cadastrar um novo insumo ou serviço?',
          instrucoesHtml: '<p>Cadastre um item novo quando ele representar um recurso real que pode entrar em orçamento ou operação. Preencha nome, categoria, unidade, preço e demais dados de controle.</p><p>Evite criar itens duplicados com nomes parecidos, pois isso fragiliza orçamento e análise de custo.</p>',
        },
        {
          titulo: 'Qual a diferença entre categoria, unidade e valor no cadastro?',
          instrucoesHtml: '<p><strong>Categoria</strong> organiza o tipo de item. <strong>Unidade</strong> define como ele será contado ou cobrado. <strong>Valor</strong> representa a base financeira usada no orçamento.</p><p>Esses três campos precisam conversar entre si para o cálculo fazer sentido.</p>',
        },
        {
          titulo: 'Quando editar um item existente em vez de criar outro?',
          instrucoesHtml: '<p>Edite o item existente quando a mudança for ajuste de preço, descrição ou configuração do mesmo recurso. Crie outro item apenas quando for um serviço diferente ou com lógica operacional realmente distinta.</p>',
        },
      ],
    },
    {
      sectionId: 'locais',
      entries: [
        {
          titulo: 'Como cadastrar um local ou parque corretamente?',
          instrucoesHtml: '<p>Cadastre o local com o máximo de informação útil para orçamento e operação: nome, cidade, estrutura, regras, taxas e observações práticas.</p><p>O objetivo é que a equipe consiga reutilizar esse cadastro sem redescobrir o local toda vez.</p>',
        },
        {
          titulo: 'Quais informações do local impactam diretamente o orçamento?',
          instrucoesHtml: '<p>Capacidade, taxas, cidade, restrições e características operacionais impactam custo e precificação. Sempre revise esses campos antes de montar uma proposta.</p><p>Um local mal cadastrado gera erro comercial e retrabalho no planejamento.</p>',
        },
        {
          titulo: 'Quando atualizar taxas e capacidades do local?',
          instrucoesHtml: '<p>Atualize sempre que houver mudança oficial do espaço ou quando a equipe confirmar uma nova condição comercial ou operacional.</p><p>Não deixe para ajustar só no orçamento. O cadastro-base precisa continuar confiável para os próximos eventos.</p>',
        },
      ],
    },
    {
      sectionId: 'parceiros',
      entries: [
        {
          titulo: 'O que devo cadastrar em Parceiros & Staff?',
          instrucoesHtml: '<p>Nessa área entram pessoas e parceiros recorrentes que apoiam a execução dos eventos, seja na operação, relacionamento ou entrega de serviços.</p><p>Mantenha dados de contato, função e observações operacionais sempre atualizados.</p>',
        },
        {
          titulo: 'Como diferenciar parceiro de staff nesse cadastro?',
          instrucoesHtml: '<p>Use <strong>parceiro</strong> para relações externas e estratégicas. Use <strong>staff</strong> para pessoas ligadas à operação prática dos eventos.</p><p>A separação ajuda na leitura interna e na montagem da equipe certa para cada entrega.</p>',
        },
        {
          titulo: 'Quando usar esse cadastro no planejamento do evento?',
          instrucoesHtml: '<p>Consulte esse módulo quando estiver montando equipe, revisando apoio externo ou validando quem pode ser acionado em determinada praça, função ou operação.</p><p>Ele é uma base de apoio para escala, relacionamento e memória operacional.</p>',
        },
      ],
    },
    {
      sectionId: 'fornecedores',
      entries: [
        {
          titulo: 'Quando devo cadastrar um fornecedor novo?',
          instrucoesHtml: '<p>Cadastre um fornecedor quando ele puder participar de cotação, entrega de material ou apoio recorrente na operação.</p><p>Se o contato ainda não tem papel claro no processo, valide antes para evitar uma base inchada e pouco confiável.</p>',
        },
        {
          titulo: 'Quais dados mínimos precisam estar atualizados no fornecedor?',
          instrucoesHtml: '<p>Mantenha nome, contato, cidade, especialidade e observações comerciais ou operacionais em dia. Esses dados são o mínimo para acionamento rápido.</p><p>Quando houver informação fiscal ou contratual relevante, registre também.</p>',
        },
        {
          titulo: 'Como usar o cadastro de fornecedores na rotina?',
          instrucoesHtml: '<p>Use o cadastro para localizar rapidamente quem pode atender determinada demanda, região ou categoria de serviço. Isso acelera cotação, contratação e reposição operacional.</p>',
        },
      ],
    },
    {
      sectionId: 'comissoes',
      entries: [
        {
          titulo: 'Como interpretar o resumo de comissões na tela?',
          instrucoesHtml: '<p>Os cards do topo resumem o que está pendente, o que já foi pago e, conforme o perfil, a visão da comissão do usuário.</p><p>Leia esse painel como um retrato financeiro rápido antes de entrar no detalhamento por linha.</p>',
        },
        {
          titulo: 'Qual a diferença entre comissão pendente e paga?',
          instrucoesHtml: '<p><strong>Pendente</strong> é o valor ainda não liquidado. <strong>Paga</strong> é a comissão já reconhecida e concluída no fluxo financeiro.</p><p>Essa distinção é importante para evitar confusão entre previsão de recebimento e valor efetivamente pago.</p>',
        },
        {
          titulo: 'Como o acesso muda entre administrador e consultor em Comissões?',
          instrucoesHtml: '<p>Consultores costumam ter leitura mais restrita, focada no que precisam acompanhar. Administradores têm acesso ampliado para conferência, liberação e gestão completa do módulo.</p><p>Sempre considere o perfil ao validar ausência de ação ou coluna na tela.</p>',
        },
      ],
    },
    {
      sectionId: 'config',
      entries: [
        {
          titulo: 'O que é controlado na tela Configurações?',
          instrucoesHtml: '<p>A tela de Configurações reúne regras do sistema que impactam formulários, orçamento interno e comportamentos padrão da operação.</p><p>Trate esse módulo como área sensível: pequenas mudanças podem refletir em várias partes do fluxo.</p>',
        },
        {
          titulo: 'Quando alterar as regras do formulário público do site?',
          instrucoesHtml: '<p>Altere essas regras quando houver mudança oficial no processo de entrada de pedidos, coleta de dados ou estratégia comercial do formulário.</p><p>Evite ajustar sem critério, porque qualquer mudança afeta a qualidade do lead recebido.</p>',
        },
        {
          titulo: 'Quando revisar as regras do orçamento interno?',
          instrucoesHtml: '<p>Revise quando houver alteração de processo comercial, política de preço, automação de perfil ou necessidade de padronização nova na proposta.</p><p>Essas regras devem refletir a forma atual de operar, não apenas um cenário antigo.</p>',
        },
      ],
    },
    {
      sectionId: 'usuarios',
      entries: [
        {
          titulo: 'Como criar um novo usuário da equipe?',
          instrucoesHtml: '<p>Abra a tela de Usuários & Equipe, clique para criar um novo cadastro e preencha nome, e-mail, perfil e demais informações necessárias.</p><p>Antes de salvar, valide se o perfil escolhido está alinhado ao tipo de acesso que a pessoa realmente precisa.</p>',
        },
        {
          titulo: 'Qual a diferença entre os perfis de acesso?',
          instrucoesHtml: '<p>Os perfis definem o alcance de cada usuário dentro do sistema. Em geral, administradores têm gestão completa e consultores operam com restrições em módulos sensíveis.</p><p>Escolher o perfil correto evita acesso excessivo e reduz erro operacional.</p>',
        },
        {
          titulo: 'Quando bloquear ou ajustar permissões de um usuário?',
          instrucoesHtml: '<p>Ajuste permissões quando a função da pessoa mudar, quando houver necessidade de restringir acesso temporariamente ou quando a operação exigir outro nível de autonomia.</p><p>Não espere um problema acontecer para revisar acesso.</p>',
        },
      ],
    },
    {
      sectionId: 'central-ajuda',
      entries: [
        {
          titulo: 'Como usar a Central de Ajuda por categoria?',
          instrucoesHtml: '<p>A Central organiza conteúdos por categoria e depois por seção do sistema. O melhor fluxo é escolher primeiro a área do processo e só então abrir a pergunta ou tutorial correspondente.</p><p>Isso reduz ruído e acelera a localização do material certo.</p>',
        },
        {
          titulo: 'Como criar ou reorganizar conteúdos da ajuda?',
          instrucoesHtml: '<p>Usuários com permissão podem criar novos conteúdos, editar textos, anexos e reorganizar a ordem das entradas dentro de cada seção.</p><p>Ao publicar, mantenha títulos claros e foco em uma dúvida por conteúdo.</p>',
        },
        {
          titulo: 'Como manter os materiais da ajuda padronizados?',
          instrucoesHtml: '<p>Escreva títulos como perguntas reais da equipe, mantenha instruções objetivas e atualize o conteúdo sempre que o fluxo do sistema mudar.</p><p>Consultores possuem acesso somente leitura, então a curadoria deve ficar concentrada nos perfis responsáveis pela manutenção.</p>',
        },
      ],
    },
  ]),
]

function mergeWithDefaultEntries(existing: HelpEntry[]) {
  const defaultById = new Map(DEFAULT_HELP_ENTRIES.map(entry => [entry.id, entry]))

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
  const missing = DEFAULT_HELP_ENTRIES.filter(entry => !existingIds.has(entry.id))
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
  const [entries, setEntries] = useState<HelpEntry[]>([])
  const richTextRef = useRef<HTMLDivElement | null>(null)
  const linkInputRef = useRef<HTMLInputElement | null>(null)
  const pendingEditorHtmlRef = useRef('')
  const savedRangeRef = useRef<Range | null>(null)
  const accordionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const grouped = groupSectionsByCategory()

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as HelpEntry[]
        setEntries(mergeWithDefaultEntries(parsed))
      } else {
        setEntries(DEFAULT_HELP_ENTRIES)
      }
    } catch {
      setEntries(DEFAULT_HELP_ENTRIES)
    }
  }, [])

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
  const entriesForSelectedCategory = selectedCategory
    ? entries.filter(e => e.category === selectedCategory)
    : []

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
                            'overflow-hidden rounded-xl border border-black/10 bg-card scroll-mt-20 transition-colors',
                            draggingEntryId === entry.id && 'opacity-60',
                            dragOverEntryId === entry.id && 'border-[#f45a06] ring-2 ring-[#f45a06]/20',
                          )}
                        >
                          <div className="flex items-center justify-between border-b bg-muted px-4 py-3">
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
