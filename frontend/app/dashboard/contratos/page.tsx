'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { contratos, Contrato, ContratoPipelineStatus } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ContratoDetalhesModal } from '@/components/dashboard/ContratoDetalhesModal'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Search, RefreshCw, Copy, Star, Zap, FileText, Clock, CheckCheck, Trash2, Building2, Users, MapPinned } from 'lucide-react'

type CardOrigemInfo = { isSite: boolean; isGerador: boolean; isInterno: boolean }

function getCardOrigemInfo(c: Contrato): CardOrigemInfo {
  const texto = `${c.descricao || ''} ${c.observacoes || ''} ${c.consultor || ''}`.toLowerCase()
  return {
    isSite: texto.includes('[origem:site]'),
    isGerador: texto.includes('[origem:gerador]') || texto.includes('gerado a partir da proposta'),
    isInterno: (c.empresa_nome || '').toLowerCase().includes('aomenos1km'),
  }
}

function isRetroativoContrato(c: Contrato) {
  const texto = `${c.descricao || ''} ${c.observacoes || ''}`.toLowerCase()
  return texto.includes('[origem:retroativo]')
}

const PIPELINE_COLUMNS: Array<{ id: ContratoPipelineStatus; title: string; border: string; headerBadge: string }> = [
  { id: 'Novo Pedido', title: 'NOVOS PEDIDOS', border: 'border-t-sky-500', headerBadge: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200' },
  { id: 'Em Negociação', title: 'EM NEGOCIAÇÃO', border: 'border-t-amber-500', headerBadge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' },
  { id: 'Aguardando PGTO', title: 'AGUARDANDO PGTO', border: 'border-t-blue-500', headerBadge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200' },
  { id: 'Confirmado', title: 'CONFIRMADO / EXECUÇÃO', border: 'border-t-emerald-500', headerBadge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' },
]

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function normalizeStatus(raw: string): ContratoPipelineStatus | '' {
  const s = (raw || '').toLowerCase()
  if (s.includes('novo') || s.includes('pedido')) return 'Novo Pedido'
  if (s.includes('lead') || s.includes('proposta') || s.includes('negocia') || s.includes('analise') || s.includes('análise')) return 'Em Negociação'
  if (s.includes('aguardando') || s.includes('pgto') || s.includes('pagamento') || s.includes('aprovado')) return 'Aguardando PGTO'
  if (s.includes('confirmado') || s.includes('execucao') || s.includes('execução') || s.includes('fechado')) return 'Confirmado'
  if (s.includes('cancelado')) return 'Cancelado'
  if (s.includes('expirado')) return 'Expirado'
  if (s.includes('finalizado') || s.includes('concluido') || s.includes('concluído')) return 'Finalizado'
  return ''
}

function cardBackground({ isSite, isInterno }: CardOrigemInfo): string {
  if (isSite) return 'bg-amber-50/70 dark:bg-amber-950/25'
  if (isInterno) return 'bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-emerald-950/30 dark:to-amber-950/30'
  return 'bg-white dark:bg-slate-800/40'
}

function colunaBordaLateral(status: ContratoPipelineStatus) {
  if (status === 'Novo Pedido') return 'border-l-sky-500'
  if (status === 'Em Negociação') return 'border-l-amber-500'
  if (status === 'Aguardando PGTO') return 'border-l-blue-500'
  return 'border-l-emerald-500'
}

function isPastEvent(value?: string) {
  if (!value) return false
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return false
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return d < hoje
}

export default function ContratosPage() {
  const { user } = useAuth()
  const isConsultor = user?.perfil === 'Consultor'
  const isAdmin = user?.perfil === 'Admin'
  const [list, setList] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [savingDrop, setSavingDrop] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contrato | null>(null)
  const [modalContratoId, setModalContratoId] = useState<string | null>(null)
  const publicFormUrl = typeof window !== 'undefined' ? `${window.location.origin}/publico/orcamento` : '/publico/orcamento'

  function carregar() {
    setLoading(true)
    contratos
      .listar({ pipeline: true, allowGlobal: isConsultor })
      .then(r => setList(r.data))
      .catch(() => toast.error('Erro ao carregar contratos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    carregar()
  }, [isConsultor])

  function canDragCard(contrato: Contrato) {
    if (!isConsultor) return true
    return (contrato.consultor || '').trim().toLowerCase() === (user?.nome || '').trim().toLowerCase()
  }

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase()
    const ativos = list
      .map(c => ({ ...c, status: normalizeStatus(c.status) || c.status }))
      .filter(c => normalizeStatus(c.status) && normalizeStatus(c.status) !== 'Cancelado' && normalizeStatus(c.status) !== 'Expirado' && normalizeStatus(c.status) !== 'Finalizado')
      .filter(c => !isPastEvent(c.data_evento))

    if (!term) return ativos
    return ativos.filter(c =>
      `${c.nome_evento} ${c.empresa_nome} ${c.consultor} ${c.local_nome} ${c.data_evento || ''}`.toLowerCase().includes(term),
    )
  }, [list, search])

  const porColuna = useMemo(() => {
    const base: Record<string, Contrato[]> = {
      'Novo Pedido': [],
      'Em Negociação': [],
      'Aguardando PGTO': [],
      Confirmado: [],
    }
    filtrados.forEach(c => {
      const st = normalizeStatus(c.status)
      if (st && base[st]) base[st].push(c)
    })
    return base
  }, [filtrados])

  async function onDropColuna(novoStatus: ContratoPipelineStatus) {
    if (!draggingId || savingDrop) return

    const snapshot = [...list]
    const atual = snapshot.find(c => c.id === draggingId)
    if (!atual) return
    const statusAtual = normalizeStatus(atual.status)
    if (statusAtual === novoStatus) return

    setSavingDrop(true)
    setList(prev => prev.map(c => (c.id === draggingId ? { ...c, status: novoStatus } : c)))
    try {
      await contratos.atualizarStatus(draggingId, novoStatus)
      toast.success(`Status atualizado para ${novoStatus}`)
    } catch {
      setList(snapshot)
      toast.error('Falha ao salvar mudança de coluna')
    } finally {
      setSavingDrop(false)
      setDraggingId(null)
    }
  }

  function pedirExclusaoNovoPedido(contrato: Contrato) {
    if (!isAdmin) {
      toast.warning('Somente administradores podem excluir contratos no Kanban')
      return
    }
    setDeleteTarget(contrato)
  }

  async function excluirNovoPedidoConfirmado() {
    if (!deleteTarget) return

    setDeletingId(deleteTarget.id)
    try {
      await contratos.deletar(deleteTarget.id)
      setList(prev => prev.filter(c => c.id !== deleteTarget.id))
      toast.success('Card removido do Kanban')
      setDeleteTarget(null)
    } catch {
      toast.error('Não foi possível remover o card')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Pipeline (Kanban)</h1>
          <p className="text-sm text-muted-foreground">{filtrados.length} card(s) ativo(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(publicFormUrl)
              toast.success('Link do formulario copiado')
            }}
          >
            <Copy className="h-4 w-4 mr-1" /> Formulario p/ Cliente
          </Button>
          <Button variant="outline" size="icon" onClick={carregar} disabled={loading || savingDrop}>
            <RefreshCw className={cn('h-4 w-4', (loading || savingDrop) && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por evento, empresa, consultor, local ou data"
          className="pl-8"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PIPELINE_COLUMNS.map(col => {
            const cards = porColuna[col.id] ?? []
            const total = cards.reduce((acc, c) => acc + Number(c.valor_total || 0), 0)
            return (
              <Card
                key={col.id}
                className={cn('border-t-4', col.border)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => void onDropColuna(col.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center justify-between gap-2">
                    <span>{col.title}</span>
                    <Badge className={cn('text-xs', col.headerBadge)} variant="outline">{cards.length}</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{moeda(total)}</p>
                </CardHeader>
                <CardContent className="space-y-2 min-h-[220px] max-h-[62vh] overflow-y-auto pr-1">
                  {cards.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhum card</p>
                  ) : (
                    cards.map(c => {
                      const origem = getCardOrigemInfo(c)
                      const isRetroativo = isRetroativoContrato(c)
                      const statusCard = normalizeStatus(c.status) || 'Novo Pedido'
                      const canDrag = canDragCard(c)
                      return (
                        <div
                          key={c.id}
                          draggable={canDrag}
                          onDragStart={() => {
                            if (!canDrag) {
                              setDraggingId(null)
                              toast.warning('Você só pode mover cards de contratos atribuídos a você')
                              return
                            }
                            setDraggingId(c.id)
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          className={cn(
                            'rounded-md border-l-4 border border-r border-t border-b p-3 transition-colors',
                            canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                            cardBackground(origem),
                            colunaBordaLateral(statusCard),
                            origem.isSite ? 'hover:bg-amber-100/70 dark:hover:bg-amber-900/30' : 'hover:bg-muted/30 dark:hover:bg-slate-700/30',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                              {origem.isInterno && <Star className="h-3.5 w-3.5 text-amber-500 dark:text-amber-300" />}
                              {c.nome_evento || 'Evento sem nome'}
                            </p>
                            {statusCard === 'Confirmado' ? (
                              <Badge variant="outline" className="text-[10px] h-5 flex items-center gap-[3px] border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                                <CheckCheck className="h-2.5 w-2.5" />Execução
                              </Badge>
                            ) : statusCard === 'Aguardando PGTO' ? (
                              <Badge variant="outline" className="text-[10px] h-5 flex items-center gap-[3px] border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                                <Clock className="h-2.5 w-2.5" />Aguardando
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-1">
                                {origem.isGerador && (
                                  <Badge variant="outline" className="text-[10px] h-5 flex items-center gap-[3px] border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
                                    <FileText className="h-2.5 w-2.5" />Proposta
                                  </Badge>
                                )}
                                {isRetroativo && (
                                  <Badge variant="outline" className="text-[10px] h-5 flex items-center gap-[3px] border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                                    Retroativo
                                  </Badge>
                                )}
                                {origem.isSite && (
                                  <Badge variant="outline" className="text-[10px] h-5 flex items-center gap-[3px] border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200">
                                    <Zap className="h-2.5 w-2.5" />Site
                                  </Badge>
                                )}
                                {!origem.isSite && !origem.isGerador && !origem.isInterno && !isRetroativo && (
                                  <Badge variant="outline" className="text-[10px] h-4 border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-300">Manual</Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="mt-1 space-y-1">
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                              {origem.isInterno ? (
                                <Star className="h-3.5 w-3.5 text-amber-500 dark:text-amber-300" />
                              ) : (
                                <Building2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                              )}
                              <span>{c.empresa_nome || 'Sem empresa'}</span>
                            </p>
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                              <MapPinned className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                              <span>{c.local_nome || 'Sem local'}</span>
                            </p>
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
                              <span>{Math.max(Number(c.qtd_contratada || 0), 0)} pessoas</span>
                            </p>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{moeda(Number(c.valor_total || 0))}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {c.data_evento ? new Date(c.data_evento).toLocaleDateString('pt-BR') : 'Sem data'}
                            </p>
                          </div>
                          {isConsultor && !canDrag && (
                            <p className="mt-1 text-[11px] text-muted-foreground">Somente leitura para movimentação</p>
                          )}
                          <div className="mt-2 flex items-center justify-end gap-2">
                            {isAdmin && (
                              <button
                                type="button"
                                className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                onClick={() => pedirExclusaoNovoPedido(c)}
                                disabled={deletingId === c.id}
                                title="Remover card"
                                aria-label="Remover card"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setModalContratoId(c.id)}
                              className="text-xs text-[#f25c05] dark:text-orange-400 inline-flex items-center gap-1 hover:opacity-80"
                            >
                              Abrir
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground">
          Arraste os cards entre colunas para alterar o status. Itens Cancelado, Expirado e Finalizado ficam fora do board para manter foco operacional.
          {isConsultor ? ' Como consultor, você visualiza todos os cards, mas só movimenta os contratos atribuídos a você.' : ''}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null)
        }}
        title="Excluir Card"
        description={`Tem certeza que deseja remover o contrato "${deleteTarget?.nome_evento || deleteTarget?.empresa_nome || ''}" do pipeline?`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={() => void excluirNovoPedidoConfirmado()}
        confirmDisabled={Boolean(deletingId)}
        destructive
      />

      <ContratoDetalhesModal
        open={Boolean(modalContratoId)}
        contratoId={modalContratoId}
        onOpenChange={open => {
          if (!open) setModalContratoId(null)
        }}
      />
    </div>
  )
}
