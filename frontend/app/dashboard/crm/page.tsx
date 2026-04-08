'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  crm,
  empresas,
  usuariosEquipe,
  type CRMPainelItem,
  type CRMPainelResponse,
  type Empresa,
  type EmpresaCRMInteracao,
  type UsuarioEquipe,
} from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { RTable, RTableBody, RTableCell, RTableHead, RTableHeader, RTableRow } from '@/components/ui/responsive-table'
import {
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react'

type Bucket = 'todas' | 'atrasadas' | 'hoje' | 'semana'
type StatusFiltro = 'todas' | 'Aberta' | 'Concluida' | 'Reagendada' | 'Cancelada'
type PrioridadeFiltro = 'todas' | 'Normal' | 'Alta' | 'Urgente'

type RegistroModal = {
  item: CRMPainelItem
  historico: EmpresaCRMInteracao[]
}

const INTERACTION_TYPES = ['Retorno', 'Prospecção', 'Follow-up', 'Anotação'] as const
const CHANNELS = ['WhatsApp', 'Ligação', 'E-mail', 'Reunião', 'Outro'] as const
const RESULTS = ['Contato Realizado', 'Sem Retorno', 'Sem Interesse', 'Convertido', 'Reagendado'] as const
const PRIORITIES = ['Normal', 'Alta', 'Urgente'] as const
const RESPONSAVEL_PADRAO = 'Selecione o responsável'

function formatDateBR(value?: string) {
  if (!value) return '—'
  const dt = new Date(`${value}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('pt-BR')
}

function formatDateTimeBR(value?: string) {
  if (!value) return '—'
  const dt = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(dt.getTime())) return value
  return dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function addDays(dateStr: string, days: number) {
  const base = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date()
    fallback.setHours(0, 0, 0, 0)
    fallback.setDate(fallback.getDate() + days)
    return fallback.toISOString().slice(0, 10)
  }
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

function situacaoBadgeClass(item: CRMPainelItem) {
  if (item.status === 'Concluida') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (item.status === 'Reagendada') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (item.status === 'Cancelada') return 'bg-slate-100 text-slate-700 border-slate-200'
  if (item.atraso_dias > 0) return 'bg-red-100 text-red-700 border-red-200'
  if (item.situacao === 'Hoje') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200'
}

function prioridadeBadgeClass(prioridade: string) {
  switch (prioridade) {
    case 'Urgente':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'Alta':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function CRMPage() {
  const { user } = useAuth()
  const isConsultor = user?.perfil === 'Consultor'
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [painel, setPainel] = useState<CRMPainelResponse | null>(null)
  const [consultores, setConsultores] = useState<UsuarioEquipe[]>([])
  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<Empresa[]>([])
  const [busca, setBusca] = useState('')
  const [bucket, setBucket] = useState<Bucket>('todas')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todas')
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<PrioridadeFiltro>('todas')
  const [consultorFiltro, setConsultorFiltro] = useState('todos')
  const [onlyMine, setOnlyMine] = useState(user?.perfil === 'Consultor')
  const [registroModal, setRegistroModal] = useState<RegistroModal | null>(null)
  const [loadingModal, setLoadingModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [nextContact, setNextContact] = useState('')
  const [interactionType, setInteractionType] = useState<string>('Retorno')
  const [channel, setChannel] = useState<string>('WhatsApp')
  const [result, setResult] = useState<string>('Contato Realizado')
  const [priority, setPriority] = useState<string>('Normal')
  const [responsavelSelecionado, setResponsavelSelecionado] = useState(RESPONSAVEL_PADRAO)
  const [novaPendenciaOpen, setNovaPendenciaOpen] = useState(false)
  const [novaEmpresaId, setNovaEmpresaId] = useState('')
  const [novaNote, setNovaNote] = useState('')
  const [novaDataContato, setNovaDataContato] = useState('')
  const [novaInteractionType, setNovaInteractionType] = useState<string>('Retorno')
  const [novaChannel, setNovaChannel] = useState<string>('WhatsApp')
  const [novaResult, setNovaResult] = useState<string>('Contato Realizado')
  const [novaPriority, setNovaPriority] = useState<string>('Normal')
  const [novaResponsavelSelecionado, setNovaResponsavelSelecionado] = useState(RESPONSAVEL_PADRAO)

  function carregarPainel(silent = false) {
    if (silent) setRefreshing(true)
    else setLoading(true)

    crm.listarPainel({
      q: busca.trim() || undefined,
      bucket: bucket === 'todas' ? undefined : bucket,
      onlyMine: isConsultor ? true : onlyMine,
      status: statusFiltro === 'todas' ? undefined : statusFiltro,
      prioridade: prioridadeFiltro === 'todas' ? undefined : prioridadeFiltro,
      consultorId: isConsultor ? undefined : (consultorFiltro === 'todos' ? undefined : consultorFiltro),
    })
      .then(res => setPainel(res.data))
      .catch(err => toast.error(err instanceof Error ? err.message : 'Erro ao carregar fila de CRM'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  async function carregarConsultores() {
    try {
      const res = await usuariosEquipe.listar()
      const lista = (res.data || []).filter(item => item.perfil === 'Consultor' || item.perfil === 'Admin')
      setConsultores(lista)
    } catch {
      setConsultores([])
    }
  }

  async function carregarEmpresas() {
    try {
      const res = await empresas.listar()
      setEmpresasDisponiveis(res.data ?? [])
    } catch {
      setEmpresasDisponiveis([])
    }
  }

  useEffect(() => {
    carregarPainel()
  }, [bucket, onlyMine, statusFiltro, prioridadeFiltro, consultorFiltro, isConsultor])

  useEffect(() => {
    if (!isConsultor) return
    setOnlyMine(true)
    setConsultorFiltro('todos')
  }, [isConsultor])

  useEffect(() => {
    carregarConsultores()
    carregarEmpresas()
  }, [])

  const pendencias = useMemo(() => painel?.pendencias ?? [], [painel])
  const metricas = painel?.metricas
  const resumo = painel?.resumo
  const empresaSelecionada = useMemo(
    () => empresasDisponiveis.find(item => item.id === novaEmpresaId) ?? null,
    [empresasDisponiveis, novaEmpresaId],
  )

  async function abrirRegistro(item: CRMPainelItem) {
    setRegistroModal({ item, historico: [] })
    setLoadingModal(true)
    setNote('')
    setNextContact(item.status === 'Aberta' ? item.data_prevista : '')
    setInteractionType('Retorno')
    setChannel('WhatsApp')
    setResult(item.status === 'Aberta' ? 'Contato Realizado' : 'Reagendado')
    setPriority(item.prioridade || 'Normal')
    const nomeResponsavel = (item.responsavel_crm || '').trim()
    setResponsavelSelecionado(isConsultor ? (user?.nome || RESPONSAVEL_PADRAO) : (nomeResponsavel || RESPONSAVEL_PADRAO))

    try {
      const res = await empresas.listarCrmInteracoes(item.empresa_id)
      setRegistroModal({ item, historico: res.data ?? [] })
    } catch {
      toast.error('Não foi possível carregar o histórico da empresa')
    } finally {
      setLoadingModal(false)
    }
  }

  async function salvarRegistro() {
    if (!registroModal) return
    if (!note.trim()) {
      toast.warning('Escreva uma anotação antes de salvar')
      return
    }

    const consultorEscolhido = isConsultor ? undefined : consultores.find(item => item.nome === responsavelSelecionado)

    setSaving(true)
    try {
      await empresas.criarCrmInteracao(registroModal.item.empresa_id, {
        texto: note.trim(),
        proximo_contato: nextContact || undefined,
        tipo_interacao: interactionType,
        canal: channel,
        resultado: result,
        prioridade: priority,
        responsavel_user_id: isConsultor ? undefined : consultorEscolhido?.id,
        responsavel_nome: isConsultor ? undefined : (responsavelSelecionado === RESPONSAVEL_PADRAO ? undefined : responsavelSelecionado),
      })
      toast.success('Interação registrada')
      setRegistroModal(null)
      carregarPainel(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar interação')
    } finally {
      setSaving(false)
    }
  }

  async function atualizarPendenciaRapida(item: CRMPainelItem, payload: { status?: string; prioridade?: string; data_prevista?: string }) {
    setActingId(item.pendencia_id)
    try {
      await crm.atualizarPendencia(item.pendencia_id, payload)
      toast.success('Pendência atualizada')
      carregarPainel(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar pendência')
    } finally {
      setActingId(current => current === item.pendencia_id ? null : current)
    }
  }

  function abrirNovaPendencia() {
    setNovaEmpresaId('')
    setNovaNote('')
    setNovaDataContato('')
    setNovaInteractionType('Retorno')
    setNovaChannel('WhatsApp')
    setNovaResult('Contato Realizado')
    setNovaPriority('Normal')
    setNovaResponsavelSelecionado(isConsultor ? (user?.nome || RESPONSAVEL_PADRAO) : RESPONSAVEL_PADRAO)
    setNovaPendenciaOpen(true)
  }

  async function salvarNovaPendencia() {
    if (!novaEmpresaId) {
      toast.warning('Selecione uma empresa para criar a pendência')
      return
    }
    if (!novaDataContato) {
      toast.warning('Informe a data do próximo contato')
      return
    }
    if (!novaNote.trim()) {
      toast.warning('Escreva uma anotação inicial para a pendência')
      return
    }

    const consultorEscolhido = isConsultor ? undefined : consultores.find(item => item.nome === novaResponsavelSelecionado)

    setSaving(true)
    try {
      await empresas.criarCrmInteracao(novaEmpresaId, {
        texto: novaNote.trim(),
        proximo_contato: novaDataContato,
        tipo_interacao: novaInteractionType,
        canal: novaChannel,
        resultado: novaResult,
        prioridade: novaPriority,
        responsavel_user_id: isConsultor ? undefined : consultorEscolhido?.id,
        responsavel_nome: isConsultor ? undefined : (novaResponsavelSelecionado === RESPONSAVEL_PADRAO ? undefined : novaResponsavelSelecionado),
      })
      toast.success('Pendência criada com sucesso')
      setNovaPendenciaOpen(false)
      carregarPainel(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar pendência')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">CRM</h1>
            <p className="text-sm text-muted-foreground">Fila operacional de retornos e acompanhamento comercial</p>
          </div>
          <Button onClick={abrirNovaPendencia}>
            <Plus className="h-4 w-4 mr-1" /> Nova pendência
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Pendências Abertas" value={resumo?.pendencias_abertas ?? 0} icon={<BellRing className="h-4 w-4" />} tone="text-slate-700" />
        <SummaryCard title="Para Hoje" value={resumo?.pendencias_hoje ?? 0} icon={<CalendarCheck2 className="h-4 w-4" />} tone="text-amber-700" />
        <SummaryCard title="Em Atraso" value={resumo?.pendencias_atraso ?? 0} icon={<PhoneCall className="h-4 w-4" />} tone="text-red-700" />
        <SummaryCard title="Próximos 7 Dias" value={resumo?.pendencias_semana ?? 0} icon={<Clock3 className="h-4 w-4" />} tone="text-emerald-700" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Interações 30 Dias" value={metricas?.interacoes_30d ?? 0} icon={<Phone className="h-4 w-4" />} tone="text-slate-700" />
        <SummaryCard title="Contatos Realizados" value={metricas?.contatos_realizados_30d ?? 0} icon={<CheckCircle2 className="h-4 w-4" />} tone="text-emerald-700" />
        <SummaryCard title="Convertidos" value={metricas?.convertidos_30d ?? 0} icon={<Target className="h-4 w-4" />} tone="text-blue-700" />
        <PercentCard title="Taxa de Conversão" value={metricas?.taxa_conversao_30d ?? 0} icon={<TrendingUp className="h-4 w-4" />} tone="text-violet-700" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-4">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') carregarPainel(true) }}
                placeholder="Buscar empresa, contato ou e-mail..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 w-full auto-rows-max">
              <Select value={bucket} onValueChange={v => setBucket((v as Bucket) ?? 'todas')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Prazo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos os prazos</SelectItem>
                  <SelectItem value="atrasadas">Atrasadas</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="semana">Próximos 7 dias</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFiltro} onValueChange={v => setStatusFiltro((v as StatusFiltro) ?? 'todas')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos status</SelectItem>
                  <SelectItem value="Aberta">Abertas</SelectItem>
                  <SelectItem value="Concluida">Concluídas</SelectItem>
                  <SelectItem value="Reagendada">Reagendadas</SelectItem>
                  <SelectItem value="Cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={prioridadeFiltro} onValueChange={v => setPrioridadeFiltro((v as PrioridadeFiltro) ?? 'todas')}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas prioridades</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
              {!isConsultor ? (
                <Select value={consultorFiltro} onValueChange={v => setConsultorFiltro(v ?? 'todos')}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Consultor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos consultores</SelectItem>
                    {consultores.map(option => (
                      <SelectItem key={option.id} value={option.id}>{option.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Button variant="default" disabled className="w-full">
                  Somente minhas
                </Button>
              )}
              {!isConsultor ? (
                <Button variant={onlyMine ? 'default' : 'outline'} onClick={() => setOnlyMine(v => !v)} className="w-full">
                  {onlyMine ? 'Somente minhas' : 'Mostrar todas'}
                </Button>
              ) : (
                <Button variant="outline" disabled className="w-full">
                  Filtro global bloqueado
                </Button>
              )}
              <Button variant="outline" onClick={() => carregarPainel(true)} disabled={refreshing} className="w-full">
                <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 shadow-none md:gap-4 md:overflow-hidden md:bg-card md:py-4 md:ring-1 md:shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fila de Relacionamento</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
            </div>
          ) : pendencias.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma pendência encontrada com os filtros atuais.</p>
          ) : (
            <RTable>
              <RTableHeader>
                <RTableRow>
                  <RTableHead>Empresa</RTableHead>
                  <RTableHead>Contato</RTableHead>
                  <RTableHead>Agenda</RTableHead>
                  <RTableHead>Prioridade</RTableHead>
                  <RTableHead>Último Registro</RTableHead>
                  <RTableHead mobileLabel="" className="text-right">Ações</RTableHead>
                </RTableRow>
              </RTableHeader>
              <RTableBody>
                {pendencias.map(item => {
                  const isOpen = item.status === 'Aberta'
                  const isActing = actingId === item.pendencia_id
                  return (
                    <RTableRow key={item.pendencia_id}>
                      <RTableCell className="align-top">
                        <div>
                          <p className="font-semibold">{item.empresa_nome}</p>
                          <p className="text-xs text-muted-foreground">{item.empresa_fantasia || item.responsavel_crm || 'Sem fantasia'}</p>
                        </div>
                      </RTableCell>
                      <RTableCell className="align-top">
                        <div className="space-y-1 text-sm">
                          <p className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5 text-slate-500" /> {item.responsavel_contato || '-'}</p>
                          <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-emerald-600" /> {item.telefone || '-'}</p>
                          <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-orange-500" /> {item.email || '-'}</p>
                          <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-rose-500" /> {[item.cidade, item.uf].filter(Boolean).join('/') || '-'}</p>
                        </div>
                      </RTableCell>
                      <RTableCell className="align-top">
                        <p className="font-medium">{formatDateBR(item.data_prevista)}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="outline" className={situacaoBadgeClass(item)}>
                            {item.situacao}{item.atraso_dias > 0 && item.status === 'Aberta' ? ` · ${item.atraso_dias}d` : ''}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.responsavel_crm || 'Sem responsável'}</p>
                      </RTableCell>
                      <RTableCell className="align-top">
                        <Badge variant="outline" className={prioridadeBadgeClass(item.prioridade)}>{item.prioridade}</Badge>
                      </RTableCell>
                      <RTableCell className="align-top max-w-[280px]">
                        <p className="text-sm line-clamp-2">{item.ultimo_texto || item.descricao_pendencia || 'Sem registro recente'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.ultimo_usuario || '—'} · {item.ultimo_resultado || '—'} · {formatDateTimeBR(item.ultimo_criado_em)}
                        </p>
                      </RTableCell>
                      <RTableCell className="text-right align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" onClick={() => abrirRegistro(item)}>Registrar</Button>
                          {isOpen && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isActing}
                                onClick={() => atualizarPendenciaRapida(item, { status: 'Concluida' })}
                              >
                                Concluir
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isActing}
                                onClick={() => atualizarPendenciaRapida(item, { data_prevista: addDays(item.data_prevista, 1), status: 'Aberta' })}
                              >
                                +1 dia
                              </Button>
                            </>
                          )}
                        </div>
                      </RTableCell>
                    </RTableRow>
                  )
                })}
              </RTableBody>
            </RTable>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(registroModal)} onOpenChange={(open) => { if (!open) setRegistroModal(null) }}>
        <DialogContent className="max-w-[980px] p-0 overflow-hidden border border-orange-200" showCloseButton={false}>
          <div className="bg-[#f25c05] text-white px-5 py-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-xl">Registrar Contato CRM</h2>
              <p className="text-sm text-white/85">{registroModal?.item.empresa_nome || 'Empresa'}</p>
            </div>
            <button type="button" onClick={() => setRegistroModal(null)} className="text-white/90 hover:text-white" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[82vh] overflow-y-auto p-5 bg-background space-y-4">
            <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tipo de interação</p>
                    <Select value={interactionType} onValueChange={v => setInteractionType(v ?? 'Retorno')}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent className="min-w-[280px]">
                        {INTERACTION_TYPES.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Canal</p>
                    <Select value={channel} onValueChange={v => setChannel(v ?? 'WhatsApp')}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Canal" /></SelectTrigger>
                      <SelectContent className="min-w-[280px]">
                        {CHANNELS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Resultado</p>
                    <Select value={result} onValueChange={v => setResult(v ?? 'Contato Realizado')}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Resultado" /></SelectTrigger>
                      <SelectContent className="min-w-[280px]">
                        {RESULTS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Prioridade</p>
                    <Select value={priority} onValueChange={v => setPriority(v ?? 'Normal')}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                      <SelectContent className="min-w-[280px]">
                        {PRIORITIES.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Responsável CRM</p>
                    {isConsultor ? (
                      <Input className="mt-1" value={user?.nome || 'Consultor'} disabled />
                    ) : (
                      <Select value={responsavelSelecionado} onValueChange={v => setResponsavelSelecionado(v ?? RESPONSAVEL_PADRAO)}>
                        <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Responsável" /></SelectTrigger>
                        <SelectContent className="min-w-[280px]">
                          <SelectItem value={RESPONSAVEL_PADRAO}>{RESPONSAVEL_PADRAO}</SelectItem>
                          {consultores.map(option => <SelectItem key={option.id} value={option.nome}>{option.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Próximo contato</p>
                    <Input className="mt-1" type="date" value={nextContact} onChange={e => setNextContact(e.target.value)} />
                    <p className="text-xs text-muted-foreground mt-1">Se deixar em branco e registrar um resultado conclusivo, a pendência atual será encerrada.</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Anotação</p>
                    <textarea
                      rows={5}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="O que foi conversado? Qual o próximo passo?"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Histórico recente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingModal ? (
                    Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)
                  ) : (registroModal?.historico.length ?? 0) > 0 ? (
                    registroModal?.historico.map(item => (
                      <div key={item.id} className="rounded-xl border bg-card px-3 py-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{item.usuario}</span>
                          <span>{item.data} {item.hora}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          <Badge variant="outline">{item.tipo_interacao || 'Anotação'}</Badge>
                          <Badge variant="outline">{item.canal || 'WhatsApp'}</Badge>
                          <Badge variant="outline">{item.resultado || 'Sem Retorno'}</Badge>
                          {item.proximo_contato && <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Próximo: {formatDateBR(item.proximo_contato)}</Badge>}
                        </div>
                        <p className="text-sm mt-2 text-foreground">{item.texto}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma interação registrada.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="border-t bg-card px-5 py-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRegistroModal(null)}>Cancelar</Button>
            <Button onClick={salvarRegistro} disabled={saving} className="bg-[#f25c05] hover:bg-[#d94f00]">
              {saving ? 'Salvando...' : 'Salvar interação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={novaPendenciaOpen} onOpenChange={setNovaPendenciaOpen}>
        <DialogContent className="max-w-[780px] p-0 overflow-hidden border border-orange-200" showCloseButton={false}>
          <div className="bg-[#f25c05] text-white px-5 py-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-xl">Nova Pendência CRM</h2>
              <p className="text-sm text-white/85">Crie um acompanhamento sem depender da tela de empresas</p>
            </div>
            <button type="button" onClick={() => setNovaPendenciaOpen(false)} className="text-white/90 hover:text-white" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[82vh] overflow-y-auto p-5 bg-background">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Empresa</p>
                  <Select value={novaEmpresaId} onValueChange={v => setNovaEmpresaId(v ?? '')}>
                    <SelectTrigger className="mt-1 w-full">
                      <span className={empresaSelecionada ? '' : 'text-muted-foreground'}>
                        {empresaSelecionada?.razao_social ?? 'Selecione a empresa'}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="min-w-[380px]">
                      {empresasDisponiveis.map(option => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tipo de interação</p>
                    <Select value={novaInteractionType} onValueChange={v => setNovaInteractionType(v ?? 'Retorno')}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent className="min-w-[280px]">
                        {INTERACTION_TYPES.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Canal</p>
                    <Select value={novaChannel} onValueChange={v => setNovaChannel(v ?? 'WhatsApp')}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Canal" /></SelectTrigger>
                      <SelectContent className="min-w-[280px]">
                        {CHANNELS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Resultado</p>
                    <Select value={novaResult} onValueChange={v => setNovaResult(v ?? 'Contato Realizado')}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Resultado" /></SelectTrigger>
                      <SelectContent className="min-w-[280px]">
                        {RESULTS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Prioridade</p>
                    <Select value={novaPriority} onValueChange={v => setNovaPriority(v ?? 'Normal')}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                      <SelectContent className="min-w-[280px]">
                        {PRIORITIES.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Responsável CRM</p>
                  {isConsultor ? (
                    <Input className="mt-1" value={user?.nome || 'Consultor'} disabled />
                  ) : (
                    <Select value={novaResponsavelSelecionado} onValueChange={v => setNovaResponsavelSelecionado(v ?? RESPONSAVEL_PADRAO)}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Responsável" /></SelectTrigger>
                      <SelectContent className="min-w-[280px]">
                        <SelectItem value={RESPONSAVEL_PADRAO}>{RESPONSAVEL_PADRAO}</SelectItem>
                        {consultores.map(option => <SelectItem key={option.id} value={option.nome}>{option.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Próximo contato</p>
                  <Input className="mt-1" type="date" value={novaDataContato} onChange={e => setNovaDataContato(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Anotação inicial</p>
                  <textarea
                    rows={5}
                    value={novaNote}
                    onChange={e => setNovaNote(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Resumo da abordagem e próximo passo"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="border-t bg-card px-5 py-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNovaPendenciaOpen(false)}>Cancelar</Button>
            <Button onClick={salvarNovaPendencia} disabled={saving} className="bg-[#f25c05] hover:bg-[#d94f00]">
              {saving ? 'Salvando...' : 'Criar pendência'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className={`text-3xl font-black mt-1 ${tone}`}>{value}</p>
          </div>
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 ${tone}`}>{icon}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function PercentCard({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className={`text-3xl font-black mt-1 ${tone}`}>{value.toFixed(1)}%</p>
          </div>
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 ${tone}`}>{icon}</span>
        </div>
      </CardContent>
    </Card>
  )
}
