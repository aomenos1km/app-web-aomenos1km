'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

import { configuracoes, empresas, orcamentos, Proposta, PropostaDetalhe } from '@/lib/api'
import { abrirPreviewProposta, PropostaPdfData } from '@/lib/proposta-pdf'
import { buildCondicoesFromComercial, parseComercialTag, parseCondicoesTag } from '@/lib/proposta-comercial'
import { useAuth } from '@/hooks/useAuth'
import { FileText, Lock, RefreshCw, Search, Trash2 } from 'lucide-react'
import { RTable, RTableHeader, RTableHead, RTableBody, RTableRow, RTableCell } from '@/components/ui/responsive-table'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value?: string) {
  if (!value) return '—'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function statusBadgeClass(status?: string) {
  switch (status) {
    case 'Finalizada':  return 'border-blue-300 bg-blue-50 text-blue-700'
    case 'Enviada':     return 'border-orange-300 bg-orange-50 text-orange-700'
    case 'Convertida':  return 'border-emerald-300 bg-emerald-50 text-emerald-700'
    default:            return 'border-slate-300 bg-slate-50 text-slate-600'  // Rascunho
  }
}

function isPropostaRetroativa(observacoes?: string) {
  return String(observacoes || '').toLowerCase().includes('[origem:retroativo]')
}

function parseRetroValorPago(observacoes?: string) {
  const texto = String(observacoes || '')
  const match = texto.match(/\[retroativo:valor_pago=([0-9]+(?:\.[0-9]+)?)\]/i)
  if (!match) return 0
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : 0
}

export default function HistoricoPropostasPage() {
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'
  const isConsultor = user?.perfil === 'Consultor'
  const [loading, setLoading] = useState(true)
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [condPagtoPadrao, setCondPagtoPadrao] = useState('50% no aceite e 50% na entrega dos kits')
  const [q, setQ] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'comerciais' | 'retroativas' | 'todas'>('comerciais')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteOneId, setDeleteOneId] = useState<string | null>(null)
  const [deleteManyOpen, setDeleteManyOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    let ativo = true
    configuracoes.buscar()
      .then(r => {
        if (!ativo) return
        const texto = r.data?.texto_condicoes_pagamento?.trim()
        if (texto) setCondPagtoPadrao(texto)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    const bump = () => carregar()
    const onVisible = () => { if (!document.hidden) bump() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('aomenos-refresh', bump)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('aomenos-refresh', bump)
    }
  }, [])

  function carregar() {
    setLoading(true)
    Promise.all([orcamentos.listarPropostas()])
      .then(([r]) => setPropostas(r.data ?? []))
      .catch(() => toast.error('Erro ao carregar histórico de propostas'))
      .finally(() => setLoading(false))
  }

  const propostasFiltradas = useMemo(() => {
    const term = q.trim().toLowerCase()
    const porTipo = propostas.filter(p => {
      const retro = isPropostaRetroativa(p.observacoes)
      if (filtroTipo === 'retroativas') return retro
      if (filtroTipo === 'comerciais') return !retro
      return true
    })
    if (!term) return porTipo
    return porTipo.filter(p =>
      `${p.empresa_nome} ${p.evento_nome} ${p.responsavel} ${p.status} ${p.valor_total}`.toLowerCase().includes(term),
    )
  }, [filtroTipo, propostas, q])

  const allVisibleSelected = propostasFiltradas.length > 0 && propostasFiltradas.every(p => selectedIds.includes(p.id))

  function toggleVisible() {
    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !propostasFiltradas.some(p => p.id === id)))
      return
    }
    const merged = new Set(selectedIds)
    propostasFiltradas.forEach(p => merged.add(p.id))
    setSelectedIds(Array.from(merged))
  }

  function toggleOne(id: string) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]))
  }

  function toPdfData(p: PropostaDetalhe, documentoEmpresa?: string, enderecoEmpresa?: string): PropostaPdfData {
    const isRetro = isPropostaRetroativa(p.observacoes)
    const comercial = parseComercialTag(p.observacoes)
    const condicoesPersistidas = parseCondicoesTag(p.observacoes)
    const condicoes = comercial ? buildCondicoesFromComercial(comercial) : null
    return {
      nomeEmpresa: p.empresa_nome || 'Cliente não informado',
      documentoEmpresa: documentoEmpresa || '-',
      responsavel: p.responsavel,
      consultorNome: p.autor_nome || undefined,
      enderecoEmpresa: enderecoEmpresa || 'Não informado',
      eventoNome: p.evento_nome || 'Evento não informado',
      dataEvento: p.data_evento,
      condPagto: condicoesPersistidas?.condPagto || condicoes?.condPagto || condPagtoPadrao,
      condValidade: condicoesPersistidas?.condValidade || condicoes?.condValidade || '10 dias corridos',
      condEntrega: condicoesPersistidas?.condEntrega || condicoes?.condEntrega || 'Até 2 dias antes do evento',
      pagamentoEntradaPercent: comercial?.entradaPercent,
      pagamentoQtdParcelas: comercial?.qtdParcelas,
      pagamentoIntervaloDias: comercial?.intervaloDias,
      pagamentoPrimeiroVencimentoDias: comercial?.primeiroVencimentoDias,
      validadeDias: comercial?.validadeDias,
      entregaDiasAntes: comercial?.entregaDiasAntes,
      qtdPessoas: Number(p.qtd_pessoas || 0),
      kmEvento: Number(p.km_evento || 0),
      localNome: p.local_nome || 'A Definir',
      cidadeEvento: p.cidade_evento || '-',
      totalGeral: Number(p.valor_total || 0),
      isRetroativo: isRetro,
      retroValorTotal: isRetro ? Number(p.valor_total || 0) : undefined,
      retroValorPago: isRetro ? parseRetroValorPago(p.observacoes) : undefined,
      itens: (p.itens ?? []).map(i => ({
        nome: i.nome,
        descricao: i.descricao || '-',
        qtd: Number(i.quantidade || 0),
        valorUnit: Number(i.valor_unitario || 0),
      })),
    }
  }

  async function abrirPdfProposta(id: string) {
    try {
      const rp = await orcamentos.buscarProposta(id)
      const p = rp.data
      let documento = '-'
      let endereco = 'Não informado'
      if (p.empresa_id) {
        try {
          const re = await empresas.buscar(p.empresa_id)
          const e = re.data
          documento = e.documento || '-'
          endereco = [e.logradouro, e.numero, e.bairro, `${e.cidade}/${e.uf}`].filter(Boolean).join(', ') || 'Não informado'
        } catch {
          // segue sem dados de endereço/documento
        }
      }
      const ok = await abrirPreviewProposta(
        toPdfData(p, documento, endereco),
        `Proposta_${(p.empresa_nome || 'Cliente').substring(0, 20).trim().replace(/\s+/g, '_')}_${p.id.slice(0, 8)}`,
      )
      if (!ok) {
        toast.error('Bloqueador de pop-ups ativo. Permita pop-ups para este site e tente novamente.')
        return
      }
      if (p.status === 'Rascunho') {
        await orcamentos.atualizarStatusProposta(p.id, 'Finalizada')
        setPropostas(prev => prev.map(item => (item.id === p.id ? { ...item, status: 'Finalizada' } : item)))
      }
    } catch {
      toast.error('Não foi possível abrir o PDF da proposta')
    }
  }

  async function confirmarDeleteOne() {
    if (!isAdmin) {
      toast.error('Somente administradores podem excluir propostas')
      setDeleteOneId(null)
      return
    }
    if (!deleteOneId) return
    setDeleting(true)
    try {
      await orcamentos.deletarProposta(deleteOneId)
      setPropostas(prev => prev.filter(p => p.id !== deleteOneId))
      setSelectedIds(prev => prev.filter(id => id !== deleteOneId))
      toast.success('Proposta removida')
    } catch {
      toast.error('Não foi possível remover a proposta')
    } finally {
      setDeleting(false)
      setDeleteOneId(null)
    }
  }

  async function confirmarDeleteMany() {
    if (!isAdmin) {
      toast.error('Somente administradores podem excluir propostas')
      setDeleteManyOpen(false)
      return
    }
    setDeleting(true)
    try {
      const ids = [...selectedIds]
      const results = await Promise.allSettled(ids.map(id => orcamentos.deletarProposta(id)))
      const ok = results.filter(r => r.status === 'fulfilled').length
      const fail = results.length - ok
      if (ok > 0) {
        setPropostas(prev => prev.filter(p => !ids.includes(p.id)))
        setSelectedIds([])
      }
      if (fail === 0) toast.success(`${ok} propostas removidas`)
      else toast.warning(`${ok} removidas, ${fail} falharam`)
    } finally {
      setDeleting(false)
      setDeleteManyOpen(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Histórico de Propostas</h1>
        <p className="text-sm text-muted-foreground">Consulta das propostas comerciais geradas no sistema</p>
        <p className="text-xs text-muted-foreground mt-1">
          Fluxo de status: Rascunho → Finalizada (após abrir PDF) → Enviada (quando for enviada ao cliente) → Convertida.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por cliente, evento ou valor..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border bg-white p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFiltroTipo('comerciais')}
              className={`rounded px-2 py-1 ${filtroTipo === 'comerciais' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              Comerciais
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('retroativas')}
              className={`rounded px-2 py-1 ${filtroTipo === 'retroativas' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
            >
              Retroativas
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('todas')}
              className={`rounded px-2 py-1 ${filtroTipo === 'todas' ? 'bg-zinc-700 text-white' : 'text-slate-600'}`}
            >
              Todas
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={carregar}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {isAdmin && selectedIds.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-amber-900">
            {selectedIds.length} proposta(s) selecionada(s)
          </p>
          <Button variant="destructive" size="sm" onClick={() => setDeleteManyOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir Selecionadas
          </Button>
        </div>
      )}

      <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 shadow-none md:gap-4 md:overflow-hidden md:bg-card md:py-4 md:ring-1 md:shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Propostas ({propostasFiltradas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : propostasFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma proposta encontrada</p>
          ) : (
            <>
              <div className="space-y-4 md:hidden">
                {propostasFiltradas.map(p => (
                  <div key={p.id} className="relative rounded-xl border border-border border-l-4 border-l-[#f25c05] bg-card px-4 pt-4 pb-4 shadow-sm">
                    {isAdmin ? (
                      <div className="absolute right-3 top-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => toggleOne(p.id)}
                          className="h-4 w-4 accent-[#f25c05]"
                          aria-label={`Selecionar proposta ${p.evento_nome || p.id}`}
                        />
                      </div>
                    ) : null}

                    <div className="space-y-3 pr-8">
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Data Criação</p>
                        <p className="text-sm text-foreground">{formatDate(p.criado_em)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
                        <p className="font-medium text-foreground">{p.empresa_nome || '—'}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Evento</p>
                        <p className="text-foreground">{p.evento_nome || '—'}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Valor</p>
                        <p className="font-semibold text-emerald-700">{formatCurrency(Number(p.valor_total || 0))}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                        <div className="flex items-center gap-1">
                          {isPropostaRetroativa(p.observacoes) && <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-indigo-700">Retroativo</Badge>}
                          <Badge variant="outline" className={statusBadgeClass(p.status)}>{p.status || 'Rascunho'}</Badge>
                        </div>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">PDF</p>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void abrirPdfProposta(p.id)}>
                          <FileText className="h-4 w-4 text-[#f25c05]" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end border-t border-border pt-3">
                      {isAdmin ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteOneId(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled title="Apenas administradores podem excluir propostas">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <RTable>
                  <RTableHeader>
                    <RTableRow>
                      {isAdmin ? (
                        <RTableHead className="w-[48px]" mobileLabel="">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleVisible}
                            className="h-4 w-4 accent-[#f25c05]"
                            aria-label="Selecionar todas as propostas visíveis"
                          />
                        </RTableHead>
                      ) : null}
                      <RTableHead>Data Criação</RTableHead>
                      <RTableHead>Cliente</RTableHead>
                      <RTableHead>Evento</RTableHead>
                      <RTableHead>Valor</RTableHead>
                      <RTableHead>Status</RTableHead>
                      <RTableHead>PDF</RTableHead>
                      <RTableHead mobileLabel="">Ações</RTableHead>
                    </RTableRow>
                  </RTableHeader>
                  <RTableBody>
                    {propostasFiltradas.map(p => (
                      <RTableRow key={p.id} selected={selectedIds.includes(p.id)}>
                        {isAdmin ? (
                          <RTableCell>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(p.id)}
                              onChange={() => toggleOne(p.id)}
                              className="h-4 w-4 accent-[#f25c05]"
                              aria-label={`Selecionar proposta ${p.evento_nome || p.id}`}
                            />
                          </RTableCell>
                        ) : null}
                        <RTableCell className="text-sm">{formatDate(p.criado_em)}</RTableCell>
                        <RTableCell className="font-medium">{p.empresa_nome || '—'}</RTableCell>
                        <RTableCell>{p.evento_nome || '—'}</RTableCell>
                        <RTableCell className="font-semibold text-emerald-700">{formatCurrency(Number(p.valor_total || 0))}</RTableCell>
                        <RTableCell>
                          <div className="flex items-center gap-1">
                            {isPropostaRetroativa(p.observacoes) && <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-indigo-700">Retroativo</Badge>}
                            <Badge variant="outline" className={statusBadgeClass(p.status)}>{p.status || 'Rascunho'}</Badge>
                          </div>
                        </RTableCell>
                        <RTableCell>
                          <Button variant="ghost" size="icon" onClick={() => void abrirPdfProposta(p.id)}>
                            <FileText className="h-4 w-4 text-[#f25c05]" />
                          </Button>
                        </RTableCell>
                        <RTableCell>
                          {isAdmin ? (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteOneId(p.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" disabled title="Apenas administradores podem excluir propostas">
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </RTableCell>
                      </RTableRow>
                    ))}
                  </RTableBody>
                </RTable>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteOneId}
        onOpenChange={open => !open && setDeleteOneId(null)}
        title="Excluir Proposta"
        description="Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita."
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir'}
        destructive
        onConfirm={confirmarDeleteOne}
      />

      <ConfirmDialog
        open={deleteManyOpen}
        onOpenChange={setDeleteManyOpen}
        title="Excluir Selecionadas"
        description={`Deseja excluir ${selectedIds.length} propostas selecionadas?`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir Selecionadas'}
        destructive
        onConfirm={confirmarDeleteMany}
      />
    </div>
  )
}
