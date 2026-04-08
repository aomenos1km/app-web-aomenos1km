'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  dashboard,
  DashboardStats,
  MetaMensal,
  Tendencia,
  RankingConsultor,
  RankingEvento,
  PerformanceConsultor,
  contratos,
  Contrato,
  comissoes,
  type ComissaoExtratoItem,
  orcamentos,
} from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  HandCoins,
  History,
  RefreshCcw,
  Route,
  Target,
  TriangleAlert,
  Users,
  XCircle,
} from 'lucide-react'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

function moeda(v: number) {
  return BRL.format(Number(v || 0))
}

function normalizeText(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function stageFromStatus(status: string): 'confirmado' | 'negociacao' | 'aguardando' | 'perdido' | 'outros' {
  const s = normalizeText(status)
  if (s.includes('cancel') || s.includes('expir')) return 'perdido'
  if (s.includes('confirm')) return 'confirmado'
  if (s.includes('aguardando') || s.includes('pgto') || s.includes('pagamento') || s.includes('aprovado')) return 'aguardando'
  if (s.includes('negocia') || s.includes('proposta') || s.includes('lead') || s.includes('novo pedido') || s.includes('analise')) return 'negociacao'
  return 'outros'
}

function dateInMonthYear(dateValue: string | undefined, mes: string, ano: string) {
  if (!dateValue) return false
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return false
  return String(d.getFullYear()) === ano && String(d.getMonth() + 1).padStart(2, '0') === mes
}

function daysUntil(dateValue?: string | null) {
  if (!dateValue) return null
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function pct(inscritos: number, total: number) {
  if (!total || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((inscritos / total) * 100)))
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'

  const now = new Date()
  const [ano, setAno] = useState(String(now.getFullYear()))
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, '0'))

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [listaContratos, setListaContratos] = useState<Contrato[]>([])
  const [extratoComissao, setExtratoComissao] = useState<ComissaoExtratoItem[]>([])
  const [pedidosPendentes, setPedidosPendentes] = useState(0)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)
  const [metaMensal, setMetaMensal] = useState<MetaMensal | null>(null)
  const [tendencia, setTendencia] = useState<Tendencia[]>([])
  const [rankingConsultores, setRankingConsultores] = useState<RankingConsultor[]>([])
  const [rankingEventos, setRankingEventos] = useState<RankingEvento[]>([])
  const [performanceConsultores, setPerformanceConsultores] = useState<PerformanceConsultor[]>([])

  const anoOptions = useMemo(() => {
    const end = now.getFullYear() + 1
    const start = now.getFullYear() - 3
    const arr: string[] = []
    for (let y = end; y >= start; y--) arr.push(String(y))
    return arr
  }, [now])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [resStats, resContratos, resComissoes, resPendentes, resMetaMensal, resTendencia, resRankingConsultores, resRankingEventos, resPerformance] = await Promise.all([
        dashboard.stats({ ano, mes }),
        contratos.listar(),
        comissoes.listarExtrato({ ano, mes }),
        orcamentos.listarPendentes().catch(() => ({ data: [] as any[] })),
        dashboard.metaMensal({ ano, mes }),
        dashboard.tendencia6Meses(),
        dashboard.rankingConsultores({ ano, mes }),
        dashboard.rankingEventos({ ano, mes }),
        dashboard.performanceOrcamentosVendas({ ano, mes }),
      ])

      setStats(resStats.data as DashboardStats)
      setListaContratos((resContratos.data as Contrato[]) || [])
      setExtratoComissao((resComissoes.data?.itens as ComissaoExtratoItem[]) || [])
      setPedidosPendentes(Array.isArray((resPendentes as any).data) ? (resPendentes as any).data.length : 0)
      setMetaMensal((resMetaMensal.data as MetaMensal) || null)
      setTendencia((resTendencia.data as Tendencia[]) || [])
      setRankingConsultores((resRankingConsultores.data as RankingConsultor[]) || [])
      setRankingEventos((resRankingEventos.data as RankingEvento[]) || [])
      setPerformanceConsultores((resPerformance.data as PerformanceConsultor[]) || [])
      setUltimaAtualizacao(new Date())
    } catch {
      toast.error('Não foi possível carregar os indicadores do dashboard')
      setStats(null)
      setListaContratos([])
      setExtratoComissao([])
      setPedidosPendentes(0)
    } finally {
      setLoading(false)
    }
  }, [ano, mes])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // ─── Real-time updates (silencioso a cada 30 segundos) ─────────────────────
  useEffect(() => {
    const carregarSilencioso = async () => {
      try {
        const [resStats, resContratos, resComissoes, resPendentes, resMetaMensal, resTendencia, resRankingConsultores, resRankingEventos, resPerformance] = await Promise.all([
          dashboard.stats({ ano, mes }),
          contratos.listar(),
          comissoes.listarExtrato({ ano, mes }),
          orcamentos.listarPendentes().catch(() => ({ data: [] as any[] })),
          dashboard.metaMensal({ ano, mes }),
          dashboard.tendencia6Meses(),
          dashboard.rankingConsultores({ ano, mes }),
          dashboard.rankingEventos({ ano, mes }),
          dashboard.performanceOrcamentosVendas({ ano, mes }),
        ])

        // Atualiza os dados sem mostrar loading
        setStats(resStats.data as DashboardStats)
        setListaContratos((resContratos.data as Contrato[]) || [])
        setExtratoComissao((resComissoes.data?.itens as ComissaoExtratoItem[]) || [])
        setPedidosPendentes(Array.isArray((resPendentes as any).data) ? (resPendentes as any).data.length : 0)
        setMetaMensal((resMetaMensal.data as MetaMensal) || null)
        setTendencia((resTendencia.data as Tendencia[]) || [])
        setRankingConsultores((resRankingConsultores.data as RankingConsultor[]) || [])
        setRankingEventos((resRankingEventos.data as RankingEvento[]) || [])
        setPerformanceConsultores((resPerformance.data as PerformanceConsultor[]) || [])
        setUltimaAtualizacao(new Date())
      } catch {
        // Falha silenciosa - não mostra erro, apenas continua
      }
    }

    const interval = setInterval(() => {
      void carregarSilencioso()
    }, 30000) // 30 segundos

    return () => clearInterval(interval)
  }, [ano, mes])

  const contratosPeriodo = useMemo(
    () => listaContratos.filter(c => dateInMonthYear(c.data_evento, mes, ano)),
    [listaContratos, mes, ano],
  )

  const resumoPeriodo = useMemo(() => {
    let vendasConfirmadas = 0
    let pipelineNegociacao = 0
    let aguardandoPgto = 0
    let perdidos = 0
    let qtdConfirmados = 0
    let qtdNegociacao = 0
    let qtdAguardando = 0
    let kmContratados = 0

    for (const c of contratosPeriodo) {
      const stage = stageFromStatus(c.status)
      const valor = Number(c.valor_total || 0)
      const km = parseFloat(String(c.km || '').replace(',', '.'))
      if (!Number.isNaN(km)) kmContratados += km

      if (stage === 'confirmado') {
        vendasConfirmadas += valor
        qtdConfirmados++
      } else if (stage === 'negociacao') {
        pipelineNegociacao += valor
        qtdNegociacao++
      } else if (stage === 'aguardando') {
        aguardandoPgto += valor
        qtdAguardando++
      } else if (stage === 'perdido') {
        perdidos++
      }
    }

    const oportunidades = qtdConfirmados + qtdNegociacao + qtdAguardando + perdidos
    const taxaConversao = oportunidades > 0 ? (qtdConfirmados / oportunidades) * 100 : 0
    const ticketMedio = qtdConfirmados > 0 ? vendasConfirmadas / qtdConfirmados : 0

    return {
      vendasConfirmadas,
      pipelineNegociacao,
      aguardandoPgto,
      perdidos,
      qtdConfirmados,
      qtdNegociacao,
      qtdAguardando,
      kmContratados,
      taxaConversao,
      ticketMedio,
    }
  }, [contratosPeriodo])

  const resumoComissao = useMemo(() => {
    let totalPendente = 0
    let totalPago = 0
    let minhaComissao = 0

    for (const item of extratoComissao) {
      const pendente = normalizeText(item.comissao_status || 'pendente') !== 'pago'
      if (pendente) totalPendente += Number(item.valor_comissao || 0)
      else totalPago += Number(item.valor_comissao || 0)

      if (normalizeText(item.consultor || '') === normalizeText(user?.nome || '')) {
        minhaComissao += Number(item.valor_comissao || 0)
      }
    }

    return { totalPendente, totalPago, minhaComissao }
  }, [extratoComissao, user?.nome])

  const eventosEmRisco = useMemo(() => {
    return (stats?.proximos_eventos || []).filter(ev => {
      const dias = daysUntil(ev.data_evento)
      const ocup = pct(ev.qtd_inscritos, ev.qtd_total)
      return dias !== null && dias <= 15 && ocup < 50
    })
  }, [stats?.proximos_eventos])

  const statusBars = useMemo(() => {
    const totalValor =
      resumoPeriodo.vendasConfirmadas +
      resumoPeriodo.pipelineNegociacao +
      resumoPeriodo.aguardandoPgto

    return [
      {
        label: 'Confirmados',
        count: resumoPeriodo.qtdConfirmados,
        value: resumoPeriodo.vendasConfirmadas,
        pct: totalValor > 0 ? (resumoPeriodo.vendasConfirmadas / totalValor) * 100 : 0,
        color: 'bg-emerald-500',
      },
      {
        label: 'Em negociação',
        count: resumoPeriodo.qtdNegociacao,
        value: resumoPeriodo.pipelineNegociacao,
        pct: totalValor > 0 ? (resumoPeriodo.pipelineNegociacao / totalValor) * 100 : 0,
        color: 'bg-amber-500',
      },
      {
        label: 'Aguardando pgto',
        count: resumoPeriodo.qtdAguardando,
        value: resumoPeriodo.aguardandoPgto,
        pct: totalValor > 0 ? (resumoPeriodo.aguardandoPgto / totalValor) * 100 : 0,
        color: 'bg-blue-500',
      },
    ]
  }, [resumoPeriodo])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-5xl font-black tracking-tight">Visão Geral</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {ultimaAtualizacao
              ? `Atualizado às ${ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Carregando indicadores'}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border bg-card p-2 shadow-sm">
          <Select value={mes} onValueChange={v => setMes(v ?? mes)}>
            <SelectTrigger className="w-[150px] border-0 shadow-none">{MONTH_OPTIONS.find(m => m.value === mes)?.label || 'Mês'}</SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={ano} onValueChange={v => setAno(v ?? ano)}>
            <SelectTrigger className="w-[95px] border-0 shadow-none">{ano}</SelectTrigger>
            <SelectContent>
              {anoOptions.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={() => void carregar()} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Sincronizando</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase text-muted-foreground">Vendas Confirmadas</p>
                <p className="mt-2 text-3xl lg:text-4xl font-bold text-emerald-700 break-words">{moeda(resumoPeriodo.vendasConfirmadas)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{resumoPeriodo.qtdConfirmados} contrato(s) no período</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase text-muted-foreground">Pipeline (Em Negociação)</p>
                <p className="mt-2 text-3xl lg:text-4xl font-bold text-amber-600 break-words">{moeda(resumoPeriodo.pipelineNegociacao)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{resumoPeriodo.qtdNegociacao} oportunidade(s) ativas</p>
              </CardContent>
            </Card>

            <Card className="border-0 bg-[#ff6b0a] text-white">
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase text-white/90">{isAdmin ? 'Comissões (A pagar)' : 'Minha Comissão'}</p>
                <p className="mt-2 text-3xl lg:text-4xl font-bold break-words">{moeda(isAdmin ? resumoComissao.totalPendente : resumoComissao.minhaComissao)}</p>
                <p className="mt-1 text-xs text-white/90">
                  {isAdmin ? 'Total devido à equipe no período' : 'Previsão de ganho no período'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-cyan-500">
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase text-muted-foreground">KM Contratados</p>
                <p className="mt-2 text-3xl lg:text-4xl font-bold text-cyan-600 break-words">{Math.round(resumoPeriodo.kmContratados)} km</p>
                <p className="mt-1 text-xs text-muted-foreground">Estimativa por contratos do período</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-rose-500">
              <CardContent className="p-5">
                <p className="text-xs font-bold uppercase text-muted-foreground">Perdidos / Expirados</p>
                <p className="mt-2 text-3xl lg:text-4xl font-bold text-rose-600 break-words">{resumoPeriodo.perdidos}</p>
                <p className="mt-1 text-xs text-muted-foreground">Risco comercial no período</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-[#f25c05]" /> Performance Comercial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Ticket médio</span>
              <strong>{moeda(resumoPeriodo.ticketMedio)}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Taxa de conversão</span>
              <strong>{resumoPeriodo.taxaConversao.toFixed(1)}%</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Aguardando pagamento</span>
              <strong>{moeda(resumoPeriodo.aguardandoPgto)}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Pedidos pendentes (site)</span>
              <strong>{pedidosPendentes}</strong>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4 text-[#f25c05]" /> Distribuição do Funil</CardTitle>
            <Link href="/dashboard/contratos" className="text-sm text-primary flex items-center gap-1 hover:underline">
              Abrir Pipeline <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusBars.map(item => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">{item.count} item(ns) · {moeda(item.value)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(100, Math.max(4, item.pct))}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#f25c05]" /> Próximos Eventos</CardTitle>
            <Link href="/dashboard/agenda" className="text-sm text-primary flex items-center gap-1 hover:underline">
              Ver agenda <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : !stats?.proximos_eventos?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem eventos futuros cadastrados.</p>
            ) : (
              <div className="space-y-2">
                {stats.proximos_eventos.map(ev => {
                  const p = pct(ev.qtd_inscritos, ev.qtd_total)
                  const dias = daysUntil(ev.data_evento)
                  return (
                    <Link key={ev.id} href={`/dashboard/contratos/${ev.id}?from=dashboard`} className="block rounded-xl border p-3 hover:bg-muted/40">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{ev.nome_evento}</p>
                          <p className="text-xs text-muted-foreground truncate">{ev.empresa_nome} · {ev.local_nome}</p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="font-medium">{ev.data_evento ? new Date(ev.data_evento).toLocaleDateString('pt-BR') : 'Sem data'}</p>
                          <p className="text-muted-foreground">{dias === null ? '-' : dias < 0 ? 'Evento passado' : `${dias} dia(s)`}</p>
                        </div>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${p < 40 ? 'bg-rose-500' : p < 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(3, p)}%` }} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{ev.qtd_inscritos}/{ev.qtd_total} inscritos</span>
                        <span>{p}% ocupação</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-[#f25c05]" /> Alertas do Período</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Eventos ativos</p>
              <p className="text-xl font-black">{stats?.total_eventos_ativos || 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Participantes captados</p>
              <p className="text-xl font-black">{stats?.total_participantes_mes || 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Ocupação média global</p>
              <p className="text-xl font-black">{(stats?.ocupacao_media || 0).toFixed(0)}%</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Eventos em risco (15 dias)</p>
              <p className="text-xl font-black">{eventosEmRisco.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Critério: até 15 dias e menos de 50% de ocupação</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações rápidas de gestão</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            { href: '/dashboard/orcamentos', label: 'Novo Orçamento', icon: CircleDollarSign },
            { href: '/dashboard/contratos', label: 'Pipeline (Kanban)', icon: Briefcase },
            { href: '/dashboard/crm', label: 'CRM', icon: Users },
            { href: '/dashboard/empresas', label: 'Empresas', icon: Building2 },
            { href: '/dashboard/gestao-evento', label: 'Gestão do Evento', icon: ClipboardList },
            { href: '/dashboard/historico', label: 'Histórico & Leads', icon: History },
          ].map(item => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className="rounded-xl border bg-card p-3 hover:bg-muted/50">
                <Icon className="h-5 w-5 text-[#f25c05]" />
                <p className="mt-2 text-sm font-semibold leading-tight">{item.label}</p>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#f25c05]" /> Resumo do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase text-muted-foreground">Período Selecionado</p>
              <p className="text-lg font-semibold">{MONTH_OPTIONS.find(m => m.value === mes)?.label}</p>
              <p className="text-sm text-muted-foreground">{ano}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase text-muted-foreground">Receita Total</p>
              <p className="text-lg font-semibold text-emerald-700">{moeda(stats?.receita_total || 0)}</p>
              <p className="text-xs text-muted-foreground">No período</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase text-muted-foreground">Comissão Paga</p>
              <p className="text-lg font-semibold text-[#ff6b0a]">{moeda(resumoComissao.totalPago)}</p>
              <p className="text-xs text-muted-foreground">Já liberada</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase text-muted-foreground">Pendentes</p>
              <p className="text-lg font-semibold text-rose-600">{resumoPeriodo.perdidos}</p>
              <p className="text-xs text-muted-foreground">Cancelados/Expirados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Segunda Camada Profissional ─────────────────────────────────────── */}
      <div className="mt-8 border-t pt-8">
        <h2 className="mb-4 text-lg font-bold text-foreground">Análise Profunda</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Meta Mensal com Semáforo */}
          {metaMensal && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-[#f25c05]" /> Meta Mensal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Andamento da meta:</span>
                    <strong className="text-lg">{metaMensal.percentual_atingimento.toFixed(1)}%</strong>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        metaMensal.status === 'verde'
                          ? 'bg-green-500'
                          : metaMensal.status === 'amarelo'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, metaMensal.percentual_atingimento)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1 rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Meta</p>
                    <p className="font-bold text-emerald-700">{moeda(metaMensal.meta_vendas)}</p>
                  </div>
                  <div className="space-y-1 rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Realizado</p>
                    <p className="font-bold text-blue-600">{moeda(metaMensal.receita_realizada)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg p-2 bg-muted/50">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      metaMensal.status === 'verde'
                        ? 'bg-green-500'
                        : metaMensal.status === 'amarelo'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                  />
                  <span className="text-xs font-medium">
                    {metaMensal.status === 'verde'
                      ? '✓ Meta atingida'
                      : metaMensal.status === 'amarelo'
                        ? '⚠ Próximo à meta'
                        : '✗ Abaixo da meta'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tendência 6 Meses */}
          <Card className="md:col-span-2 xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4 text-[#f25c05]" /> Tendência dos Últimos 6 Meses</CardTitle>
            </CardHeader>
            <CardContent>
              {tendencia.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Sem dados históricos</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {(() => {
                      const maxVendas = Math.max(...tendencia.map(t => t.vendas), 1)
                      return [...tendencia].reverse().map(item => {
                        const percentual = (item.vendas / maxVendas) * 100
                        return (
                          <div key={`${item.ano}-${item.mes}`} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="w-16 text-sm font-medium">{String(item.mes).padStart(2, '0')}/{item.ano}</span>
                              <div className="flex-1 mx-3">
                                <div
                                  className={`h-8 rounded-lg flex items-center justify-end pr-3 text-xs font-bold text-white transition-all ${
                                    percentual >= 75
                                      ? 'bg-emerald-500'
                                      : percentual >= 50
                                        ? 'bg-blue-500'
                                        : percentual >= 25
                                          ? 'bg-amber-500'
                                          : 'bg-slate-400'
                                  }`}
                                  style={{ width: `${Math.max(20, percentual)}%` }}
                                >
                                  {item.vendas > 0 && moeda(item.vendas)}
                                </div>
                              </div>
                              <span className="w-20 text-right text-xs font-medium text-muted-foreground">{item.contratos} cttos</span>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                  
                  {/* Legenda */}
                  <div className="mt-4 pt-4 border-t space-y-2 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">Legenda:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="block w-3 h-3 rounded bg-emerald-500" />
                        <span>≥75% do maior mês</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="block w-3 h-3 rounded bg-blue-500" />
                        <span>50-75%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="block w-3 h-3 rounded bg-amber-500" />
                        <span>25-50%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="block w-3 h-3 rounded bg-slate-400" />
                        <span>&lt;25%</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs">
                      <strong>Esquerda:</strong> Mês/Ano | 
                      <strong className="ml-2">Centro:</strong> Faturamento (barra proporcional ao melhor mês) | 
                      <strong className="ml-2">Direita:</strong> Contratos fechados
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ranking de Consultores */}
        {rankingConsultores.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-[#f25c05]" /> Top Consultores do Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-muted-foreground text-xs font-bold uppercase">
                      <th className="text-left p-2">Consultor</th>
                      <th className="text-right p-2">Vendas</th>
                      <th className="text-right p-2">Eventos</th>
                      <th className="text-right p-2">Comissão Paga</th>
                      <th className="text-right p-2">Pendente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingConsultores.slice(0, 5).map((consultor, idx) => (
                      <tr key={consultor.consultor} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0 font-bold">
                              {idx + 1}
                            </Badge>
                            <span className="font-medium">{consultor.consultor}</span>
                          </div>
                        </td>
                        <td className="text-right p-2 font-bold text-emerald-700">{moeda(consultor.total_vendas)}</td>
                        <td className="text-right p-2 text-muted-foreground">{consultor.total_eventos}</td>
                        <td className="text-right p-2 text-[#ff6b0a] font-semibold">{moeda(consultor.comissao_paga)}</td>
                        <td className="text-right p-2 text-rose-600 font-semibold">{moeda(consultor.comissao_pendente)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ranking de Eventos por Conversão */}
        {rankingEventos.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#f25c05]" /> Eventos por Taxa de Conversão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-muted-foreground text-xs font-bold uppercase">
                      <th className="text-left p-2">Evento</th>
                      <th className="text-right p-2">Inscritos</th>
                      <th className="text-right p-2">Capacidade</th>
                      <th className="text-right p-2">Ocupação</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingEventos.slice(0, 5).map(evento => (
                      <tr key={evento.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{evento.nome_evento}</p>
                            <p className="text-xs text-muted-foreground truncate">{evento.empresa_nome}</p>
                          </div>
                        </td>
                        <td className="text-right p-2">{evento.total_inscritos}</td>
                        <td className="text-right p-2">{evento.qtd_contratada}</td>
                        <td className="text-right p-2">
                          <span className="font-bold">{evento.taxa_ocupacao.toFixed(1)}%</span>
                        </td>
                        <td className="text-center p-2">
                          <Badge
                            variant="outline"
                            className={
                              evento.taxa_ocupacao >= 70
                                ? 'bg-green-100 text-green-800'
                                : evento.taxa_ocupacao >= 50
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }
                          >
                            {evento.taxa_ocupacao >= 70 ? '✓ Ótimo' : evento.taxa_ocupacao >= 50 ? '⚠ Bom' : '✗ Baixo'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance: Orçamentos vs Vendas */}
        {performanceConsultores.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#f25c05]" /> Performance: Orçamentos vs. Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performanceConsultores.map(consultor => {
                  const maxOrcamentos = Math.max(...performanceConsultores.map(c => c.orcamentos_criados), 1)
                  const maxVendas = Math.max(...performanceConsultores.map(c => c.vendas_fechadas), 1)
                  const orcPct = (consultor.orcamentos_criados / maxOrcamentos) * 100
                  const vendPct = (consultor.vendas_fechadas / maxVendas) * 100

                  return (
                    <div key={consultor.consultor} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{consultor.consultor}</span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {consultor.taxa_conversao.toFixed(1)}% conversão
                        </span>
                      </div>
                      <div className="flex gap-1 h-8">
                        <div className="flex-1 rounded-lg bg-blue-500 flex items-center justify-end pr-2 text-xs font-bold text-white" style={{ width: `${Math.max(5, orcPct)}%` }}>
                          {consultor.orcamentos_criados} orc
                        </div>
                        <div className="flex-1 rounded-lg bg-emerald-500 flex items-center justify-end pr-2 text-xs font-bold text-white" style={{ width: `${Math.max(5, vendPct)}%` }}>
                          {consultor.vendas_fechadas} vnd
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legenda */}
              <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="block w-4 h-4 rounded bg-blue-500" />
                  <span>Orçamentos Criados</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="block w-4 h-4 rounded bg-emerald-500" />
                  <span>Vendas Fechadas</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
