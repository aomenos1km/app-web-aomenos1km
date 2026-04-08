'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { contratos, participantes, usuariosEquipe, Contrato, Participante, UsuarioEquipe } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  RTable,
  RTableBody,
  RTableCell,
  RTableHead,
  RTableHeader,
  RTableRow,
} from '@/components/ui/responsive-table'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  List,
  MapPin,
  Search,
  Users,
  Wallet,
  ExternalLink,
} from 'lucide-react'

type AgendaView = 'mes' | 'semana' | 'lista'
type DetailTab = 'resumo' | 'participantes' | 'financeiro'
type EventoAgenda = Contrato & { dataObj: Date; dateKey: string }

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const WEEKDAY_HEADER_STYLES = [
  'border-sky-200 bg-sky-50 text-sky-700',
  'border-cyan-200 bg-cyan-50 text-cyan-700',
  'border-emerald-200 bg-emerald-50 text-emerald-700',
  'border-amber-200 bg-amber-50 text-amber-700',
  'border-orange-200 bg-orange-50 text-orange-700',
  'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  'border-violet-200 bg-violet-50 text-violet-700',
]
const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const STATUS_THEMES = {
  blue: {
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  },
  yellow: {
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    dot: 'bg-yellow-500',
    chip: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
  },
  green: {
    badge: 'bg-green-100 text-green-800 border-green-200',
    dot: 'bg-green-500',
    chip: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  },
  red: {
    badge: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
    chip: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
  },
  purple: {
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    dot: 'bg-purple-500',
    chip: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  },
}

function parseContratoDate(value?: string): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (isoDate) {
    const year = Number(isoDate[1])
    const month = Number(isoDate[2])
    const day = Number(isoDate[3])
    const result = new Date(year, month - 1, day)
    return Number.isNaN(result.getTime()) ? null : result
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function toDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function getStartOfWeek(date: Date) {
  const base = toStartOfDay(date)
  const mondayOffset = (base.getDay() + 6) % 7
  base.setDate(base.getDate() - mondayOffset)
  return base
}

function getStatusTheme(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('confirm')) return STATUS_THEMES.green
  if (normalized.includes('negoc')) return STATUS_THEMES.yellow
  if (normalized.includes('cancel')) return STATUS_THEMES.red
  if (normalized.includes('conclu') || normalized.includes('final')) return STATUS_THEMES.purple
  return STATUS_THEMES.blue
}

function formatDateLong(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseDescricaoContrato(raw?: string) {
  const text = String(raw || '').trim()
  if (!text) return 'Sem descrição'

  const textoLimpo = text.replace(/\[origem:[^\]]+\]/gi, '').replace(/\s+/g, ' ').trim()
  return textoLimpo || 'Sem descrição'
}

export default function AgendaPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Contrato[]>([])
  const [view, setView] = useState<AgendaView>('mes')
  const [anchorDate, setAnchorDate] = useState<Date>(() => toStartOfDay(new Date()))
  const [statusFilter, setStatusFilter] = useState('all')
  const [consultorFilter, setConsultorFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<EventoAgenda | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailEvento, setDetailEvento] = useState<Contrato | null>(null)
  const [detailParts, setDetailParts] = useState<Participante[]>([])
  const [detailTab, setDetailTab] = useState<DetailTab>('resumo')
  const [usuariosList, setUsuariosList] = useState<UsuarioEquipe[]>([])

  useEffect(() => {
    contratos
      .listar()
      .then(r => setRows(r.data))
      .catch(() => toast.error('Erro ao carregar agenda'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    usuariosEquipe
      .listar()
      .then(r => setUsuariosList(r.data || []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!selectedEvent) {
      setDetailEvento(null)
      setDetailParts([])
      return
    }

    let active = true
    setDetailLoading(true)

    Promise.all([
      contratos.buscar(selectedEvent.id),
      participantes.listarPorContrato(selectedEvent.id),
    ])
      .then(([c, p]) => {
        if (!active) return
        setDetailEvento(c.data)
        setDetailParts(p.data)
      })
      .catch(() => {
        if (!active) return
        toast.error('Erro ao carregar detalhes do evento')
      })
      .finally(() => {
        if (active) setDetailLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedEvent])

  const today = useMemo(() => toStartOfDay(new Date()), [])

  const eventos = useMemo<EventoAgenda[]>(() => {
    return rows
      .map(row => {
        const parsed = parseContratoDate(row.data_evento)
        if (!parsed) return null
        const dataObj = toStartOfDay(parsed)
        return { ...row, dataObj, dateKey: toDateKey(dataObj) }
      })
      .filter((row): row is EventoAgenda => !!row)
  }, [rows])

  const statusOptions = useMemo(() => {
    return Array.from(new Set(eventos.map(item => item.status).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [eventos])

  const consultorOptions = useMemo(() => {
    return usuariosList
      .filter(usuario => usuario.ativo && (usuario.perfil === 'Consultor' || usuario.perfil === 'Admin'))
      .map(usuario => usuario.nome)
      .sort((a, b) => a.localeCompare(b))
  }, [usuariosList])

  const selectedStatusLabel = statusFilter === 'all' ? 'Todos os status' : statusFilter
  const selectedConsultorLabel = consultorFilter === 'all' ? 'Todos os consultores' : consultorFilter

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return eventos
      .filter(item => (statusFilter === 'all' ? true : item.status === statusFilter))
      .filter(item => (consultorFilter === 'all' ? true : item.consultor === consultorFilter))
      .filter(item => {
        if (!q) return true
        const haystack = `${item.nome_evento} ${item.empresa_nome} ${item.local_nome} ${item.consultor}`.toLowerCase()
        return haystack.includes(q)
      })
      .sort((a, b) => a.dataObj.getTime() - b.dataObj.getTime())
  }, [eventos, statusFilter, consultorFilter, query])

  const conflictMap = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of filtered) {
      const key = `${item.dateKey}::${(item.local_nome || '').trim().toLowerCase()}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [filtered])

  const conflictKeys = useMemo(() => {
    return new Set(Array.from(conflictMap.entries()).filter(([, count]) => count > 1).map(([key]) => key))
  }, [conflictMap])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventoAgenda[]>()
    for (const item of filtered) {
      const current = map.get(item.dateKey)
      if (current) {
        current.push(item)
      } else {
        map.set(item.dateKey, [item])
      }
    }
    return map
  }, [filtered])

  const monthStart = useMemo(() => new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1), [anchorDate])
  const monthEnd = useMemo(() => new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0), [anchorDate])

  const monthEvents = useMemo(() => {
    return filtered.filter(item => item.dataObj >= monthStart && item.dataObj <= monthEnd)
  }, [filtered, monthStart, monthEnd])

  const next7DaysCount = useMemo(() => {
    const limit = addDays(today, 6)
    return filtered.filter(item => item.dataObj >= today && item.dataObj <= limit).length
  }, [filtered, today])

  const totalMonthValue = useMemo(() => {
    return monthEvents.reduce((acc, item) => acc + (Number(item.valor_total) || 0), 0)
  }, [monthEvents])

  const confirmedMonthCount = useMemo(() => {
    return monthEvents.filter(item => item.status.toLowerCase().includes('confirm')).length
  }, [monthEvents])

  const negotiationMonthCount = useMemo(() => {
    return monthEvents.filter(item => item.status.toLowerCase().includes('negoc')).length
  }, [monthEvents])

  const monthGridDays = useMemo(() => {
    const firstDow = (monthStart.getDay() + 6) % 7
    const start = addDays(monthStart, -firstDow)
    return Array.from({ length: 42 }).map((_, index) => addDays(start, index))
  }, [monthStart])

  const weekDays = useMemo(() => {
    const start = getStartOfWeek(anchorDate)
    return Array.from({ length: 7 }).map((_, index) => addDays(start, index))
  }, [anchorDate])

  const listUpcoming = useMemo(() => {
    const now = new Date()
    const nowStart = toStartOfDay(now)
    return filtered
      .filter(c => c.dataObj >= nowStart)
      .sort((a, b) => a.dataObj.getTime() - b.dataObj.getTime())
  }, [filtered])

  const monthLabel = useMemo(() => {
    return anchorDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }, [anchorDate])

  function goPrev() {
    setAnchorDate(prev => (view === 'semana' ? addDays(prev, -7) : addMonths(prev, -1)))
  }

  function goNext() {
    setAnchorDate(prev => (view === 'semana' ? addDays(prev, 7) : addMonths(prev, 1)))
  }

  function goToday() {
    setAnchorDate(toStartOfDay(new Date()))
  }

  function hasConflict(item: EventoAgenda) {
    const key = `${item.dateKey}::${(item.local_nome || '').trim().toLowerCase()}`
    return conflictKeys.has(key)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Agenda</h1>
        <p className="text-sm text-muted-foreground">Planejamento inteligente de eventos com visão mensal, semanal e lista</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo do período</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Eventos no mês</p>
            <p className="text-2xl font-semibold">{monthEvents.length}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Confirmados no mês</p>
            <p className="text-2xl font-semibold text-emerald-700">{confirmedMonthCount}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Em negociação no mês</p>
            <p className="text-2xl font-semibold text-amber-700">{negotiationMonthCount}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Valor estimado do mês</p>
            <p className="text-2xl font-semibold text-sky-700">{BRL_FORMATTER.format(totalMonthValue)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToday}>Hoje</Button>
              <Button variant="outline" size="icon-sm" onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <p className="ml-2 text-sm font-medium capitalize">{monthLabel}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant={view === 'mes' ? 'default' : 'outline'} size="sm" onClick={() => setView('mes')}>
                <CalendarDays className="h-3.5 w-3.5" /> Mês
              </Button>
              <Button variant={view === 'semana' ? 'default' : 'outline'} size="sm" onClick={() => setView('semana')}>
                <CalendarRange className="h-3.5 w-3.5" /> Semana
              </Button>
              <Button variant={view === 'lista' ? 'default' : 'outline'} size="sm" onClick={() => setView('lista')}>
                <List className="h-3.5 w-3.5" /> Lista
              </Button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por evento, cliente, local ou consultor"
                className="pl-8"
              />
            </div>

            <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
              <SelectTrigger className="w-full">
                <span className={statusFilter === 'all' ? 'text-muted-foreground' : ''}>{selectedStatusLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusOptions.map(status => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={consultorFilter} onValueChange={v => setConsultorFilter(v ?? 'all')}>
              <SelectTrigger className="w-full">
                <span className={consultorFilter === 'all' ? 'text-muted-foreground' : ''}>{selectedConsultorLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os consultores</SelectItem>
                {consultorOptions.map(consultor => (
                  <SelectItem key={consultor} value={consultor}>
                    {consultor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Próximos 7 dias: {next7DaysCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Conflitos de local/data: {conflictKeys.size}
            </span>
            <span className="inline-flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5" /> Receita estimada do mês: {BRL_FORMATTER.format(totalMonthValue)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum evento encontrado com os filtros aplicados</p>
          ) : (
            <>
              {view === 'mes' && (
                <div>
                  <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
                    {WEEKDAYS.map((day, index) => (
                      <div
                        key={day}
                        className={cn(
                          'rounded-md border py-1.5 font-semibold tracking-wide shadow-sm',
                          WEEKDAY_HEADER_STYLES[index]
                        )}
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {monthGridDays.map(day => {
                      const dateKey = toDateKey(day)
                      const dayEvents = eventsByDate.get(dateKey) ?? []
                      const isCurrentMonth = day.getMonth() === monthStart.getMonth()
                      const isToday = toDateKey(day) === toDateKey(today)

                      return (
                        <div
                          key={dateKey}
                          className={cn(
                            'min-h-28 rounded-lg border p-2 md:min-h-36',
                            isCurrentMonth ? 'bg-background' : 'bg-muted/20',
                            isToday ? 'ring-2 ring-primary/40' : ''
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setAnchorDate(day)}
                            className={cn(
                              'mb-2 inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs font-medium',
                              isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {day.toLocaleDateString('pt-BR', { day: '2-digit' })}
                          </button>

                          <div className="space-y-1">
                            {dayEvents.slice(0, 3).map(item => {
                              const theme = getStatusTheme(item.status)
                              const conflict = hasConflict(item)
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setSelectedEvent(item)}
                                  className={cn(
                                    'flex w-full items-center gap-1 rounded border px-1.5 py-1 text-left text-[11px] leading-tight',
                                    theme.chip,
                                    conflict ? 'ring-1 ring-amber-400' : ''
                                  )}
                                  title={item.nome_evento}
                                >
                                  <span className={cn('h-1.5 w-1.5 rounded-full', theme.dot)} />
                                  <span className="truncate">{item.nome_evento}</span>
                                  {conflict && <AlertTriangle className="ml-auto h-3 w-3 shrink-0 text-amber-600" />}
                                </button>
                              )
                            })}

                            {dayEvents.length > 3 && (
                              <p className="px-1 text-[11px] text-muted-foreground">+{dayEvents.length - 3} eventos</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {view === 'semana' && (
                <div className="grid gap-2 md:grid-cols-7">
                  {weekDays.map(day => {
                    const key = toDateKey(day)
                    const dayEvents = (eventsByDate.get(key) ?? []).sort((a, b) => a.nome_evento.localeCompare(b.nome_evento))
                    const isToday = key === toDateKey(today)

                    return (
                      <div key={key} className={cn('rounded-lg border p-2', isToday ? 'ring-2 ring-primary/40' : '')}>
                        <p className="text-xs font-medium text-muted-foreground capitalize">
                          {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                        </p>
                        <p className="mb-2 text-sm font-semibold">{day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>

                        <div className="space-y-1.5">
                          {dayEvents.length === 0 && <p className="text-xs text-muted-foreground">Sem eventos</p>}
                          {dayEvents.map(item => {
                            const theme = getStatusTheme(item.status)
                            const conflict = hasConflict(item)
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedEvent(item)}
                                className={cn(
                                  'w-full rounded border px-2 py-1 text-left text-xs',
                                  theme.chip,
                                  conflict ? 'ring-1 ring-amber-400' : ''
                                )}
                              >
                                <p className="truncate font-medium">{item.nome_evento}</p>
                                <p className="truncate text-[11px] opacity-80">{item.local_nome || 'Local não informado'}</p>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {view === 'lista' && (
                <div className="divide-y">
                  {listUpcoming.map(item => {
                    const theme = getStatusTheme(item.status)
                    const conflict = hasConflict(item)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedEvent(item)}
                        className="flex w-full items-center gap-4 rounded px-2 py-3 text-left hover:bg-muted/50"
                      >
                        <div className="w-14 shrink-0 text-center">
                          <p className="text-xs uppercase text-muted-foreground">
                            {item.dataObj.toLocaleDateString('pt-BR', { month: 'short' })}
                          </p>
                          <p className="text-xl font-bold leading-none">{item.dataObj.toLocaleDateString('pt-BR', { day: '2-digit' })}</p>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.nome_evento}</p>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {item.local_nome || 'Local não informado'}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{item.empresa_nome}</p>
                        </div>

                        <div className="shrink-0 text-right">
                          <Badge variant="outline" className={theme.badge}>
                            {item.status}
                          </Badge>
                          {conflict && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700">
                              <AlertTriangle className="h-3 w-3" /> conflito
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}

                  {listUpcoming.length === 0 && (
                    <p className="py-10 text-center text-sm text-muted-foreground">Nenhum evento futuro para exibir na lista</p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Próxima evolução: integração com Google Calendar e Outlook + lembretes automáticos por WhatsApp.
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedEvent}
        onOpenChange={open => {
          if (!open) setSelectedEvent(null)
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{(detailEvento ?? selectedEvent).nome_evento}</DialogTitle>
                <DialogDescription>
                  {formatDateLong(selectedEvent.dataObj)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-lg border p-1">
                  <Button
                    size="sm"
                    variant={detailTab === 'resumo' ? 'default' : 'ghost'}
                    onClick={() => setDetailTab('resumo')}
                  >
                    Resumo
                  </Button>
                  <Button
                    size="sm"
                    variant={detailTab === 'participantes' ? 'default' : 'ghost'}
                    onClick={() => setDetailTab('participantes')}
                  >
                    Participantes ({detailParts.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={detailTab === 'financeiro' ? 'default' : 'ghost'}
                    onClick={() => setDetailTab('financeiro')}
                  >
                    Financeiro
                  </Button>
                </div>

                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/dashboard/contratos/${selectedEvent.id}`} />}
                >
                  <ExternalLink className="h-4 w-4 mr-1" /> Abrir no pipeline (opcional)
                </Button>
              </div>

              {detailLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-52 w-full" />
                </div>
              ) : (
                <>
                  {detailTab === 'resumo' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Informações gerais</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <Row label="Status">
                            <Badge variant="outline" className={getStatusTheme((detailEvento ?? selectedEvent).status).badge}>
                              {(detailEvento ?? selectedEvent).status}
                            </Badge>
                          </Row>
                          <Row label="Data">
                            {selectedEvent.dataObj.toLocaleDateString('pt-BR')}
                          </Row>
                          <Row label="Local">{(detailEvento ?? selectedEvent).local_nome || '—'}</Row>
                          <Row label="Modalidade">{(detailEvento ?? selectedEvent).modalidade || '—'}</Row>
                          <Row label="KM">{(detailEvento ?? selectedEvent).km || '—'}</Row>
                          <Row label="Consultor">{(detailEvento ?? selectedEvent).consultor || '—'}</Row>
                          <Row label="Cliente">{(detailEvento ?? selectedEvent).empresa_nome || '—'}</Row>
                          <div className="pt-2 border-t">
                            <p className="text-muted-foreground">Descrição</p>
                            <p className="text-right font-medium">
                              {parseDescricaoContrato((detailEvento ?? selectedEvent).descricao)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Resumo operacional</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <Row label="Participantes inscritos">{detailParts.length}</Row>
                          <Row label="Vagas contratadas">{Number((detailEvento ?? selectedEvent).qtd_contratada || 0)}</Row>
                          <Row label="Valor total">{moeda(Number((detailEvento ?? selectedEvent).valor_total) || 0)}</Row>
                          <Row label="Conflito de agenda">
                            {hasConflict(selectedEvent) ? (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <AlertTriangle className="h-3.5 w-3.5" /> Sim
                              </span>
                            ) : (
                              'Não'
                            )}
                          </Row>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {detailTab === 'participantes' && (
                    <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 shadow-none md:gap-4 md:overflow-hidden md:bg-card md:py-4 md:ring-1 md:shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base">Participantes ({detailParts.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {detailParts.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum participante inscrito ainda</p>
                        ) : (
                          <div className="md:overflow-x-auto">
                            <RTable>
                              <RTableHeader>
                                <RTableRow>
                                  <RTableHead>Nome</RTableHead>
                                  <RTableHead>WhatsApp</RTableHead>
                                  <RTableHead>CPF</RTableHead>
                                  <RTableHead>Modalidade</RTableHead>
                                  <RTableHead>Camiseta</RTableHead>
                                  <RTableHead>Pagamento</RTableHead>
                                  <RTableHead>Inscrito em</RTableHead>
                                </RTableRow>
                              </RTableHeader>
                              <RTableBody>
                                {detailParts.map(p => (
                                  <RTableRow key={p.id}>
                                    <RTableCell className="font-medium">{p.nome}</RTableCell>
                                    <RTableCell>{p.whatsapp}</RTableCell>
                                    <RTableCell className="font-mono text-xs">{p.cpf}</RTableCell>
                                    <RTableCell>{p.modalidade}</RTableCell>
                                    <RTableCell>{p.tamanho_camiseta}</RTableCell>
                                    <RTableCell>
                                      <Badge
                                        variant="outline"
                                        className={
                                          p.status_pagamento === 'Pago'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-yellow-100 text-yellow-800'
                                        }
                                      >
                                        {p.status_pagamento}
                                      </Badge>
                                    </RTableCell>
                                    <RTableCell className="text-xs text-muted-foreground">
                                      {new Date(p.data_inscricao).toLocaleDateString('pt-BR')}
                                    </RTableCell>
                                  </RTableRow>
                                ))}
                              </RTableBody>
                            </RTable>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {detailTab === 'financeiro' && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Financeiro e vagas</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <Row label="Valor total">{moeda(Number((detailEvento ?? selectedEvent).valor_total) || 0)}</Row>
                        <Row label="Valor pago">{moeda(Number((detailEvento ?? selectedEvent).valor_pago) || 0)}</Row>
                        <Row label="Participantes inscritos">{detailParts.length}</Row>
                        <Row label="Vagas contratadas">{Number((detailEvento ?? selectedEvent).qtd_contratada || 0)}</Row>
                        <Row label="Taxa de ocupação">
                          {(() => {
                            const vagas = Number((detailEvento ?? selectedEvent).qtd_contratada || 0)
                            const pct = vagas > 0 ? Math.round((detailParts.length / vagas) * 100) : 0
                            return `${detailParts.length}/${vagas} (${pct}%)`
                          })()}
                        </Row>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}
