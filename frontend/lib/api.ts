const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('token')
}

type RequestInit = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    // Token expirado — limpa sessão e redireciona para login
    if (typeof window !== 'undefined') {
      sessionStorage.clear()
      window.location.href = '/login'
    }
    throw new Error('Sessão expirada')
  }

  const raw = await res.text()
  let data: ({ error?: string } & T) | undefined
  try {
    data = raw ? (JSON.parse(raw) as ({ error?: string } & T)) : undefined
  } catch {
    data = undefined
  }

  if (!res.ok) {
    const fallbackMessage = raw && !raw.trim().startsWith('<') ? raw.trim() : `Erro ${res.status}`
    throw new Error(data?.error || fallbackMessage)
  }

  return (data ?? ({} as T)) as T
}

// ─── Auth ─────────────────────────────────────────────
export interface LoginResponse {
  token: string
  perfil: string
  nome: string
  id: string
}

export const auth = {
  login: (login: string, senha: string) =>
    apiFetch<{ success: boolean; data: LoginResponse }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, senha }),
    }),
  me: () => apiFetch<{ success: boolean; data: unknown }>('/api/auth/me'),
  alterarSenha: (senhaAtual: string, novaSenha: string) =>
    apiFetch('/api/auth/senha', {
      method: 'PUT',
      body: JSON.stringify({ senha_atual: senhaAtual, nova_senha: novaSenha }),
    }),
}

export interface InscricaoTransmissao {
  id: string
  email: string
  origem: string
  ativo: boolean
  inscrito_em: string
}

export const transmissao = {
  inscrever: async (email: string, origem = 'landing') => {
    const res = await fetch(`${API_BASE}/api/transmissao/inscricao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, origem }),
    })

    const raw = await res.text()
    let data: { success?: boolean; error?: string; message?: string } | undefined
    try {
      data = raw ? (JSON.parse(raw) as { success?: boolean; error?: string; message?: string }) : undefined
    } catch {
      data = undefined
    }

    if (!res.ok) {
      const fallbackMessage = raw && !raw.trim().startsWith('<') ? raw.trim() : `Erro ${res.status}`
      throw new Error(data?.error || fallbackMessage)
    }

    return (data ?? { success: true }) as { success: boolean; message?: string }
  },
  listarInscricoes: () => apiFetch<{ success: boolean; data: InscricaoTransmissao[] }>('/api/transmissao/inscricoes'),
}

export interface UsuarioEquipe {
  id: string
  nome: string
  login: string
  email: string
  perfil: 'Admin' | 'Consultor' | 'Visualizador'
  ativo: boolean
  comissao_percent: number
  criado_em: string
}

export interface UsuarioEquipeInput {
  nome: string
  login: string
  senha?: string
  email: string
  perfil: 'Admin' | 'Consultor' | 'Visualizador'
  ativo: boolean
  comissao_percent: number
}

export const usuariosEquipe = {
  listar: () => apiFetch<{ success: boolean; data: UsuarioEquipe[] }>('/api/usuarios'),
  criar: (data: Omit<UsuarioEquipeInput, 'senha'> & { senha: string }) =>
    apiFetch<{ success: boolean; data: UsuarioEquipe }>('/api/admin/usuarios', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  atualizar: (id: string, data: UsuarioEquipeInput) =>
    apiFetch<{ success: boolean; data: UsuarioEquipe }>(`/api/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletar: (id: string) => apiFetch(`/api/usuarios/${id}`, { method: 'DELETE' }),
}

// ─── Dashboard ─────────────────────────────────────────
export interface DashboardStats {
  total_eventos_ativos: number
  total_eventos_mes: number
  total_participantes_mes: number
  receita_mes: number
  receita_total: number
  ocupacao_media: number
  proximos_eventos: ContratoResumo[]
}

export interface MetaMensal {
  meta_vendas: number
  receita_realizada: number
  percentual_atingimento: number
  status: 'vermelho' | 'amarelo' | 'verde'
}

export interface Tendencia {
  mes: number
  ano: number
  mes_nome: string
  vendas: number
  contratos: number
}

export interface RankingConsultor {
  consultor: string
  total_eventos: number
  total_vendas: number
  comissao_paga: number
  comissao_pendente: number
}

export interface RankingEvento {
  id: string
  nome_evento: string
  empresa_nome: string
  local_nome: string
  data_evento: string
  total_inscritos: number
  qtd_contratada: number
  taxa_ocupacao: number
  taxa_conversao: number
}

export interface PerformanceConsultor {
  consultor: string
  orcamentos_criados: number
  vendas_fechadas: number
  taxa_conversao: number
}

export const dashboard = {
  stats: (params?: { ano?: string; mes?: string }) => {
    const payload: Record<string, string> = {}
    if (params?.ano) payload.ano = params.ano
    if (params?.mes) payload.mes = params.mes
    const qs = new URLSearchParams(payload).toString()
    return apiFetch<{ success: boolean; data: DashboardStats }>(`/api/dashboard${qs ? '?' + qs : ''}`)
  },
  metaMensal: (params?: { ano?: string; mes?: string }) => {
    const payload: Record<string, string> = {}
    if (params?.ano) payload.ano = params.ano
    if (params?.mes) payload.mes = params.mes
    const qs = new URLSearchParams(payload).toString()
    return apiFetch<{ success: boolean; data: MetaMensal }>(`/api/dashboard/meta-mensal${qs ? '?' + qs : ''}`)
  },
  tendencia6Meses: () => apiFetch<{ success: boolean; data: Tendencia[] }>('/api/dashboard/tendencia-6-meses'),
  rankingConsultores: (params?: { ano?: string; mes?: string }) => {
    const payload: Record<string, string> = {}
    if (params?.ano) payload.ano = params.ano
    if (params?.mes) payload.mes = params.mes
    const qs = new URLSearchParams(payload).toString()
    return apiFetch<{ success: boolean; data: RankingConsultor[] }>(`/api/dashboard/ranking-consultores${qs ? '?' + qs : ''}`)
  },
  rankingEventos: (params?: { ano?: string; mes?: string }) => {
    const payload: Record<string, string> = {}
    if (params?.ano) payload.ano = params.ano
    if (params?.mes) payload.mes = params.mes
    const qs = new URLSearchParams(payload).toString()
    return apiFetch<{ success: boolean; data: RankingEvento[] }>(`/api/dashboard/ranking-eventos${qs ? '?' + qs : ''}`)
  },
  performanceOrcamentosVendas: (params?: { ano?: string; mes?: string }) => {
    const payload: Record<string, string> = {}
    if (params?.ano) payload.ano = params.ano
    if (params?.mes) payload.mes = params.mes
    const qs = new URLSearchParams(payload).toString()
    return apiFetch<{ success: boolean; data: PerformanceConsultor[] }>(`/api/dashboard/performance-orcamentos-vendas${qs ? '?' + qs : ''}`)
  },
}

export interface ContratoResumo {
  id: string
  nome_evento: string
  empresa_nome: string
  data_evento: string | null
  local_nome: string
  status: string
  qtd_inscritos: number
  qtd_total: number
}

// ─── Contratos ─────────────────────────────────────────
export interface Contrato {
  id: string
  empresa_id?: string
  empresa_nome: string
  descricao: string
  valor_total: number
  data_evento?: string
  local_nome: string
  modalidade: string
  qtd_contratada: number
  qtd_kit: number
  km: string
  status: string
  valor_pago: number
  consultor: string
  possui_kit: boolean
  tipo_kit: string
  link_gateway: string
  qr_code_pix: string
  nome_evento: string
  capa_url: string
  observacoes: string
  pix_copia_cola: string
  qtd_inscritos: number
  criado_em: string
}

export type ContratoPipelineStatus =
  | 'Novo Pedido'
  | 'Em Negociação'
  | 'Aguardando PGTO'
  | 'Confirmado'
  | 'Cancelado'
  | 'Expirado'
  | 'Finalizado'

export interface ContratoPublico {
  id: string
  empresa_nome: string
  nome_evento: string
  valor_total: number
  data_evento?: string
  local_nome: string
  modalidade: string
  link_gateway: string
  qr_code_pix: string
  capa_url: string
  pix_copia_cola: string
  preco_ingresso?: number | null
  vagas_total: number
  vagas_ocupadas: number
  percentual_vagas: number
}

export const contratos = {
  listar: (params?: { status?: string; consultor?: string; pipeline?: boolean; allowGlobal?: boolean }) => {
    const payload: Record<string, string> = {}
    if (params?.status) payload.status = params.status
    if (params?.consultor) payload.consultor = params.consultor
    if (typeof params?.pipeline === 'boolean') payload.pipeline = String(params.pipeline)
    if (typeof params?.allowGlobal === 'boolean') payload.allow_global = String(params.allowGlobal)
    const qs = new URLSearchParams(payload).toString()
    return apiFetch<{ success: boolean; data: Contrato[] }>(`/api/contratos${qs ? '?' + qs : ''}`)
  },
  buscar: (id: string) => apiFetch<{ success: boolean; data: Contrato }>(`/api/contratos/${id}`),
  buscarPublico: (id: string) =>
    apiFetch<{ success: boolean; data: ContratoPublico }>(`/api/eventos/${id}/publico`),
  buscarPublicoPorSlug: (slug: string) =>
    apiFetch<{ success: boolean; data: ContratoPublico }>(`/api/eventos/publico/slug/${encodeURIComponent(slug)}`),
  criar: (data: Partial<Contrato>) =>
    apiFetch('/api/contratos', { method: 'POST', body: JSON.stringify(data) }),
  atualizar: (id: string, data: Partial<Contrato>) =>
    apiFetch(`/api/contratos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  atualizarStatus: (id: string, status: ContratoPipelineStatus) =>
    apiFetch(`/api/contratos/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deletar: (id: string) => apiFetch(`/api/contratos/${id}`, { method: 'DELETE' }),
}

export interface ComissaoExtratoItem {
  contrato_id: string
  empresa_nome: string
  nome_evento: string
  data_evento?: string | null
  consultor: string
  status_contrato: string
  valor_venda: number
  comissao_percent: number
  valor_comissao: number
  comissao_status: 'Pendente' | 'Pago' | string
  comissao_data_pagamento?: string | null
  comissao_pago_por?: string | null
  comissao_observacao?: string | null
}

export interface ComissaoResumo {
  total_registros: number
  total_pendente: number
  total_pago: number
  total_minha_comissao: number
  quantidade_pendentes: number
  quantidade_pagos: number
}

export interface ComissaoExtratoResponse {
  itens: ComissaoExtratoItem[]
  resumo: ComissaoResumo
}

export const comissoes = {
  listarExtrato: (params?: { ano?: string; mes?: string; consultor?: string }) => {
    const payload: Record<string, string> = {}
    if (params?.ano) payload.ano = params.ano
    if (params?.mes) payload.mes = params.mes
    if (params?.consultor) payload.consultor = params.consultor
    const qs = new URLSearchParams(payload).toString()
    return apiFetch<{ success: boolean; data: ComissaoExtratoResponse }>(`/api/comissoes/extrato${qs ? '?' + qs : ''}`)
  },
  marcarPago: (id: string, observacao = '') =>
    apiFetch<{ success: boolean; data: { id: string; status: 'Pago' } }>(`/api/comissoes/${id}/pagar`, {
      method: 'PUT',
      body: JSON.stringify({ observacao }),
    }),
}

// ─── Participantes ─────────────────────────────────────
export interface Participante {
  id: string
  contrato_id: string
  nome: string
  whatsapp: string
  email: string
  tamanho_camiseta: string
  modalidade: string
  data_inscricao: string
  cpf: string
  nascimento?: string
  cidade: string
  modalidade_distancia?: string
  tempo_pratica?: string
  tem_assessoria?: string
  objetivo?: string
  apto_fisico?: boolean
  termo_responsabilidade?: boolean
  uso_imagem?: boolean
  interesse_assessoria?: boolean
  formato_interesse?: string
  como_conheceu?: string
  observacoes?: string
  uf: string
  status_pagamento: string
  numero_kit?: number
  comprovante_url?: string
  criado_em: string
  atualizado_em?: string
}

export interface CheckinInput {
  contrato_id: string
  nome: string
  whatsapp: string
  email?: string
  cpf: string
  nascimento?: string
  tamanho_camiseta?: string
  modalidade?: string
  modalidade_distancia?: string
  tempo_pratica?: string
  tem_assessoria?: string
  objetivo?: string
  apto_fisico: boolean
  termo_responsabilidade: boolean
  uso_imagem?: boolean
  interesse_assessoria?: boolean
  formato_interesse?: string
  como_conheceu?: string
  cidade?: string
  uf?: string
  comprovante_url?: string
}

export interface CheckinResponse {
  success: boolean
  message?: string
  data?: {
    id: string
    checkout_url?: string
  }
}

export const participantes = {
  listarPorContrato: (contratoId: string) =>
    apiFetch<{ success: boolean; data: Participante[] }>(`/api/contratos/${contratoId}/participantes`),
  historico: (q?: string) => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : ''
    return apiFetch<{ success: boolean; data: unknown[] }>(`/api/participantes/historico${qs}`)
  },
  checkin: (data: CheckinInput) =>
    apiFetch<CheckinResponse>('/api/participantes/checkin', { method: 'POST', body: JSON.stringify(data) }),
  verificarStatusPagamento: (id: string) =>
    apiFetch<{ success: boolean; data: { status: string; comprovante_url?: string; pagamento_confirmado?: boolean } }>(`/api/participantes/${id}/status-pagamento`),
  editar: (id: string, data: Partial<Participante>) =>
    apiFetch(`/api/participantes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletar: (id: string) => apiFetch(`/api/participantes/${id}`, { method: 'DELETE' }),
}

// ─── Empresas ──────────────────────────────────────────
export interface Empresa {
  id: string
  documento: string
  razao_social: string
  nome_fantasia: string
  responsavel: string
  telefone: string
  email: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  tipo_pessoa: string
  status: string
  observacoes?: string
  crm_proximo_contato?: string
  crm_tem_retorno?: boolean
  crm_pendente?: boolean
  crm_ultimo_texto?: string
  crm_ultimo_usuario?: string
  crm_ultima_interacao?: string
  crm_responsavel_nome?: string
}

export interface EmpresaCRMInteracao {
  id: string
  empresa_id: string
  usuario_id?: string
  usuario: string
  texto: string
  proximo_contato?: string
  tipo_interacao: string
  canal: string
  resultado: string
  data: string
  hora: string
  criado_em: string
}

export interface CRMPainelResumo {
  pendencias_abertas: number
  pendencias_hoje: number
  pendencias_atraso: number
  pendencias_semana: number
}

export interface CRMMetricas {
  interacoes_30d: number
  contatos_realizados_30d: number
  sem_retorno_30d: number
  convertidos_30d: number
  taxa_conversao_30d: number
}

export interface CRMPainelItem {
  pendencia_id: string
  empresa_id: string
  empresa_nome: string
  empresa_fantasia: string
  responsavel_contato: string
  telefone: string
  email: string
  cidade: string
  uf: string
  data_prevista: string
  responsavel_crm: string
  descricao_pendencia: string
  prioridade: string
  status: string
  atraso_dias: number
  ultimo_texto: string
  ultimo_usuario: string
  ultimo_criado_em?: string
  ultimo_resultado: string
  ultimo_canal: string
  ultimo_tipo_interacao: string
  situacao: string
}

export interface CRMPainelResponse {
  resumo: CRMPainelResumo
  metricas: CRMMetricas
  pendencias: CRMPainelItem[]
}

export interface CRMPendencia {
  id: string
  empresa_id: string
  responsavel_user_id?: string
  responsavel_nome: string
  descricao: string
  status: string
  prioridade: string
  status_label?: string
  data_prevista: string
}

export interface CNPJConsultaData {
  nome: string
  fantasia: string
  email: string
  telefone: string
  logradouro: string
  numero: string
  bairro: string
  municipio: string
  uf: string
  cep: string
}

export const empresas = {
  listar: (params?: { status?: string; tipo?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return apiFetch<{ success: boolean; data: Empresa[] }>(`/api/empresas${qs ? '?' + qs : ''}`)
  },
  buscar: (id: string) => apiFetch<{ success: boolean; data: Empresa }>(`/api/empresas/${id}`),
  consultarCNPJ: (cnpj: string) =>
    apiFetch<{ success: boolean; data: CNPJConsultaData }>(`/api/empresas/consulta-cnpj?cnpj=${encodeURIComponent(cnpj)}`),
  criar: (data: Partial<Empresa>) =>
    apiFetch('/api/empresas', { method: 'POST', body: JSON.stringify(data) }),
  atualizar: (id: string, data: Partial<Empresa>) =>
    apiFetch(`/api/empresas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletar: (id: string) => apiFetch(`/api/empresas/${id}`, { method: 'DELETE' }),
  listarCrmInteracoes: (id: string) =>
    apiFetch<{ success: boolean; data: EmpresaCRMInteracao[] }>(`/api/empresas/${id}/crm-interacoes`),
  criarCrmInteracao: (id: string, data: { texto: string; proximo_contato?: string; tipo_interacao?: string; canal?: string; resultado?: string; prioridade?: string; responsavel_user_id?: string; responsavel_nome?: string }) =>
    apiFetch<{ success: boolean; data: EmpresaCRMInteracao }>(`/api/empresas/${id}/crm-interacoes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

export const crm = {
  listarPainel: (params?: { q?: string; bucket?: string; onlyMine?: boolean; status?: string; prioridade?: string; consultorId?: string }) => {
    const payload: Record<string, string> = {}
    if (params?.q) payload.q = params.q
    if (params?.bucket) payload.bucket = params.bucket
    if (typeof params?.onlyMine === 'boolean') payload.only_mine = String(params.onlyMine)
    if (params?.status) payload.status = params.status
    if (params?.prioridade) payload.prioridade = params.prioridade
    if (params?.consultorId) payload.consultor_id = params.consultorId
    const qs = new URLSearchParams(payload).toString()
    return apiFetch<{ success: boolean; data: CRMPainelResponse }>(`/api/crm/painel${qs ? '?' + qs : ''}`)
  },
  atualizarPendencia: (id: string, data: { status?: string; prioridade?: string; data_prevista?: string; responsavel_user_id?: string; responsavel_nome?: string }) =>
    apiFetch<{ success: boolean; data: CRMPendencia }>(`/api/crm/pendencias/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

// ─── Insumos ───────────────────────────────────────────
export interface Insumo {
  id: string
  nome: string
  categoria: string
  descricao: string
  preco_unitario: number
  unidade: string
  ativo: boolean
  criado_por_user_id?: string
}

export const insumos = {
  listar: () => apiFetch<{ success: boolean; data: Insumo[] }>('/api/insumos'),
  listarPublico: () => apiFetch<{ success: boolean; data: Insumo[] }>('/api/insumos/publico'),
  criar: (data: Partial<Insumo>) =>
    apiFetch('/api/insumos', { method: 'POST', body: JSON.stringify(data) }),
  atualizar: (id: string, data: Partial<Insumo>) =>
    apiFetch(`/api/insumos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletar: (id: string) => apiFetch(`/api/insumos/${id}`, { method: 'DELETE' }),
}

// ─── Locais ────────────────────────────────────────────
export interface Local {
  id: string
  codigo: string
  nome: string
  tipo: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  tipo_taxa: string
  taxa_valor: number
  minimo_pessoas: number
  capacidade_maxima?: number | null
  responsavel: string
  whatsapp: string
  ativo: boolean
  criado_por_user_id?: string
}

export interface PropostaItemInput {
  insumo_id?: string
  nome: string
  descricao?: string
  quantidade: number
  valor_unitario: number
}

export interface Proposta {
  id: string
  orcamento_publico_id?: string
  empresa_id?: string
  empresa_nome: string
  responsavel: string
  email: string
  telefone: string
  evento_nome: string
  data_evento?: string
  local_id?: string
  local_nome: string
  cidade_evento: string
  qtd_pessoas: number
  km_evento: number
  margem_percent: number
  subtotal_itens: number
  taxa_local: number
  valor_margem: number
  valor_total: number
  observacoes: string
  status: string
  criado_em: string
  atualizado_em: string
}

export type PropostaStatus = 'Rascunho' | 'Finalizada' | 'Enviada' | 'Convertida'

export interface PropostaItem {
  id: string
  proposta_id: string
  insumo_id?: string
  nome: string
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  ordem: number
  criado_em: string
}

export interface PropostaDetalhe extends Proposta {
  itens: PropostaItem[]
  autor_nome?: string
}

export interface PropostaInput {
  orcamento_publico_id?: string
  empresa_id?: string
  empresa_nome: string
  responsavel?: string
  email?: string
  telefone?: string
  evento_nome: string
  data_evento?: string
  local_id?: string
  local_nome?: string
  cidade_evento?: string
  qtd_pessoas?: number
  km_evento?: number
  margem_percent?: number
  subtotal_itens?: number
  taxa_local?: number
  valor_margem?: number
  valor_total?: number
  preco_ingresso?: number
  observacoes?: string
  status?: string
  itens: PropostaItemInput[]
}

export const locais = {
  listar: () => apiFetch<{ success: boolean; data: Local[] }>('/api/locais'),
  criar: (data: Partial<Local>) =>
    apiFetch('/api/locais', { method: 'POST', body: JSON.stringify(data) }),
  atualizar: (id: string, data: Partial<Local>) =>
    apiFetch(`/api/locais/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletar: (id: string) => apiFetch(`/api/locais/${id}`, { method: 'DELETE' }),
}

// ─── Notificações ──────────────────────────────────────
export interface Notificacao {
  id: string
  titulo: string
  mensagem: string
  tipo: string
  lida: boolean
  contrato_id?: string
  proposta_id?: string
  autor_nome?: string
  autor_perfil?: string
  criado_em: string
}

export const notificacoes = {
  listar: () => apiFetch<{ success: boolean; data: Notificacao[] }>('/api/notificacoes'),
  marcarLida: (id: string) => apiFetch(`/api/notificacoes/${id}/lida`, { method: 'PUT' }),
  marcarTodasLidas: () => apiFetch('/api/notificacoes/lidas', { method: 'PUT' }),
}

// ─── Orçamentos ────────────────────────────────────────
export interface OrcamentoPendente {
  id: string
  empresa_nome: string
  responsavel: string
  email: string
  telefone: string
  data_interesse?: string
  local_nome?: string
  cidade?: string
  modalidade: string
  qtd_participantes: number
  km: string
  possui_kit: boolean
  mensagem: string
  status: string
  criado_em: string
}

export interface PerfilOrcamento {
  id: string
  nome: string
  descricao: string
  ativo: boolean
  criado_em: string
}

export interface RegraOrcamento {
  id: string
  perfil_id: string
  insumo_id?: string
  nome_item: string
  tipo_regra: 'Fixo' | 'Por Pessoa' | 'Ratio'
  divisor: number
  categoria: string
  criado_em: string
}

export interface ItemCalculado {
  insumo_id?: string
  nome: string
  categoria: string
  quantidade: number
  valor_unitario: number
}

export const orcamentos = {
  enviarPublico: (data: unknown) =>
    apiFetch('/api/orcamentos/publico', { method: 'POST', body: JSON.stringify(data) }),
  listar: () => apiFetch<{ success: boolean; data: OrcamentoPendente[] }>('/api/orcamentos'),
  listarPendentes: () => apiFetch<{ success: boolean; data: OrcamentoPendente[] }>('/api/orcamentos/pendentes'),

  listarPropostas: () => apiFetch<{ success: boolean; data: Proposta[] }>('/api/propostas'),
  buscarProposta: (id: string) => apiFetch<{ success: boolean; data: PropostaDetalhe }>('/api/propostas/' + id),
  criarProposta: (data: PropostaInput) =>
    apiFetch<{ success: boolean; data: { id: string } }>('/api/propostas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  atualizarStatusProposta: (id: string, status: PropostaStatus) =>
    apiFetch('/api/propostas/' + id + '/status', {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  deletarProposta: (id: string) => apiFetch('/api/propostas/' + id, { method: 'DELETE' }),
  converterProposta: (id: string) =>
    apiFetch<{ success: boolean; data: { proposta_id: string; contrato_id: string } }>(
      '/api/propostas/' + id + '/converter',
      { method: 'POST' },
    ),
}

export const perfisOrcamento = {
  listar: () => apiFetch<{ success: boolean; data: PerfilOrcamento[] }>('/api/perfis'),
  criar: (data: { nome: string; descricao?: string; ativo?: boolean }) =>
    apiFetch<{ success: boolean; data: { id: string } }>('/api/perfis', {
      method: 'POST',
      body: JSON.stringify({ ativo: true, ...data }),
    }),
  deletar: (id: string) => apiFetch(`/api/perfis/${id}`, { method: 'DELETE' }),
  listarRegras: (perfilId: string) =>
    apiFetch<{ success: boolean; data: RegraOrcamento[] }>(`/api/perfis/${perfilId}/regras`),
  salvarRegra: (data: Omit<RegraOrcamento, 'id' | 'criado_em'>) =>
    apiFetch<{ success: boolean; data: { id: string } }>('/api/regras', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deletarRegra: (id: string) => apiFetch(`/api/regras/${id}`, { method: 'DELETE' }),
  calcularEstrutura: (perfilId: string, qtd: number) =>
    apiFetch<{ success: boolean; data: ItemCalculado[] }>(
      `/api/calcular-estrutura?perfil_id=${encodeURIComponent(perfilId)}&qtd=${qtd}`,
    ),
}

export interface ConfiguracaoSistema {
  margem_lucro: number
  custo_operacional_fixo: number
  adicional_kit_premium: number
  preco_backup_camiseta: number
  preco_backup_medalha: number
  preco_backup_squeeze: number
  preco_backup_bag: number
  preco_backup_lanche: number
  preco_backup_trofeu: number
  setup_minimo: number
  limite_setup_pessoas: number
}

export interface ConfiguracaoPublicaPreco extends ConfiguracaoSistema {
  preco_base_por_pessoa: number
}

export const configuracoes = {
  buscar: () => apiFetch<{ success: boolean; data: ConfiguracaoSistema }>('/api/configuracoes'),
  salvar: (data: ConfiguracaoSistema) =>
    apiFetch('/api/admin/configuracoes', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  buscarPrecoPublico: () =>
    apiFetch<{ success: boolean; data: ConfiguracaoPublicaPreco }>('/api/configuracoes/publico/preco'),
}

// ─── Storage (Cloudinary) ──────────────────────────────
export const storage = {
  gerarAssinatura: () =>
    apiFetch<{ success: boolean; data: CloudinarySignature }>('/api/storage/assinatura', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
}

export interface CloudinarySignature {
  cloud_name: string
  api_key: string
  timestamp: number
  signature: string
  upload_preset: string
  folder: string
}
