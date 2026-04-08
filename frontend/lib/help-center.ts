import {
  BarChart3,
  Briefcase,
  ClipboardList,
  CircleDollarSign,
  FolderOpen,
  Handshake,
  History,
  LayoutDashboard,
  MapPin,
  Mail,
  Package,
  PhoneCall,
  Settings,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type HelpCategory =
  | 'VISÃO GERAL'
  | 'COMERCIAL'
  | 'OPERACIONAL'
  | 'CADASTROS'
  | 'FINANCEIRO'
  | 'CONFIGURAÇÕES'
  | 'MATERIAL DE APOIO'

export interface HelpTopic {
  id: string
  title: string
  body: string
}

export interface HelpSection {
  id: string
  category: HelpCategory
  label: string
  route: string
  icon: LucideIcon
  topics: HelpTopic[]
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'dashboard',
    category: 'VISÃO GERAL',
    label: 'Dashboard',
    route: '/dashboard',
    icon: LayoutDashboard,
    topics: [],
  },
  {
    id: 'agenda',
    category: 'VISÃO GERAL',
    label: 'Agenda',
    route: '/dashboard/agenda',
    icon: BarChart3,
    topics: [],
  },
  {
    id: 'pipeline',
    category: 'COMERCIAL',
    label: 'Pipeline (Kanban)',
    route: '/dashboard/contratos',
    icon: Briefcase,
    topics: [],
  },
  {
    id: 'empresas',
    category: 'COMERCIAL',
    label: 'Empresas',
    route: '/dashboard/empresas',
    icon: Users,
    topics: [],
  },
  {
    id: 'crm',
    category: 'COMERCIAL',
    label: 'CRM',
    route: '/dashboard/crm',
    icon: PhoneCall,
    topics: [],
  },
  {
    id: 'transmissao',
    category: 'COMERCIAL',
    label: 'Lista de Transmissão',
    route: '/dashboard/transmissao',
    icon: Mail,
    topics: [],
  },
  {
    id: 'orcamentos',
    category: 'COMERCIAL',
    label: 'Gerador de Orçamentos',
    route: '/dashboard/orcamentos',
    icon: CircleDollarSign,
    topics: [],
  },
  {
    id: 'historico-propostas',
    category: 'COMERCIAL',
    label: 'Histórico de Propostas',
    route: '/dashboard/historico-propostas',
    icon: History,
    topics: [],
  },
  {
    id: 'gestao-evento',
    category: 'OPERACIONAL',
    label: 'Gestão do Evento',
    route: '/dashboard/gestao-evento',
    icon: ClipboardList,
    topics: [],
  },
  {
    id: 'participantes',
    category: 'OPERACIONAL',
    label: 'Participantes',
    route: '/dashboard/participantes',
    icon: Users,
    topics: [],
  },
  {
    id: 'historico',
    category: 'OPERACIONAL',
    label: 'Histórico & Leads',
    route: '/dashboard/historico',
    icon: History,
    topics: [],
  },
  {
    id: 'insumos',
    category: 'CADASTROS',
    label: 'Insumos & Serviços',
    route: '/dashboard/insumos',
    icon: Package,
    topics: [],
  },
  {
    id: 'locais',
    category: 'CADASTROS',
    label: 'Locais & Parques',
    route: '/dashboard/locais',
    icon: MapPin,
    topics: [],
  },
  {
    id: 'parceiros',
    category: 'CADASTROS',
    label: 'Parceiros & Staff',
    route: '/dashboard/parceiros',
    icon: Handshake,
    topics: [],
  },
  {
    id: 'fornecedores',
    category: 'CADASTROS',
    label: 'Fornecedores',
    route: '/dashboard/fornecedores',
    icon: Truck,
    topics: [],
  },
  {
    id: 'comissoes',
    category: 'FINANCEIRO',
    label: 'Comissões',
    route: '/dashboard/comissoes',
    icon: CircleDollarSign,
    topics: [],
  },
  {
    id: 'config',
    category: 'CONFIGURAÇÕES',
    label: 'Configurações',
    route: '/dashboard/configuracoes',
    icon: Settings,
    topics: [],
  },
  {
    id: 'usuarios',
    category: 'CONFIGURAÇÕES',
    label: 'Usuários & Equipe',
    route: '/dashboard/usuarios-equipe',
    icon: Users,
    topics: [],
  },
  {
    id: 'central-ajuda',
    category: 'MATERIAL DE APOIO',
    label: 'Central de Ajuda',
    route: '/dashboard/ajuda',
    icon: FolderOpen,
    topics: [],
  },
]

export const HELP_CATEGORY_ORDER: HelpCategory[] = [
  'VISÃO GERAL',
  'COMERCIAL',
  'OPERACIONAL',
  'CADASTROS',
  'FINANCEIRO',
  'CONFIGURAÇÕES',
  'MATERIAL DE APOIO',
]

export function groupSectionsByCategory() {
  const grouped: Record<HelpCategory, HelpSection[]> = {
    'VISÃO GERAL': [],
    COMERCIAL: [],
    OPERACIONAL: [],
    CADASTROS: [],
    FINANCEIRO: [],
    'CONFIGURAÇÕES': [],
    'MATERIAL DE APOIO': [],
  }

  HELP_SECTIONS.forEach(section => grouped[section.category].push(section))
  return grouped
}

export function findHelpSectionByPath(pathname: string): HelpSection | null {
  const exact = HELP_SECTIONS.find(section => section.route === pathname)
  if (exact) return exact

  const byPrefix = HELP_SECTIONS
    .filter(section => section.route !== '/dashboard' && pathname.startsWith(section.route))
    .sort((a, b) => b.route.length - a.route.length)

  if (byPrefix.length > 0) return byPrefix[0]
  return HELP_SECTIONS.find(section => section.route === '/dashboard') ?? null
}
