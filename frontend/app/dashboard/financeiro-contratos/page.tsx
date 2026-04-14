'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, CheckCircle2, HandCoins, Pencil, Save, Trash2, Wallet } from 'lucide-react'
import {
  contratos,
  financeiroContratos,
  type BaixaParcelaInput,
  type Contrato,
  type ParcelaContrato,
  type ParcelaContratoInput,
} from '@/lib/api'
import { parseComercialTag } from '@/lib/proposta-comercial'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RTable, RTableBody, RTableCell, RTableHead, RTableHeader, RTableRow } from '@/components/ui/responsive-table'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type ParcelaDraft = ParcelaContratoInput

function addDaysToToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDate(value?: string) {
  if (!value) return '-'
  const d = value.slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return value
  return `${day}/${m}/${y}`
}

function normalizeDateInput(value: string) {
  return (value || '').slice(0, 10)
}

function dividirParcelas(valorTotal: number, qtd: number) {
  const out: number[] = []
  if (qtd <= 0 || valorTotal <= 0) return out
  const base = Number((valorTotal / qtd).toFixed(2))
  for (let i = 0; i < qtd; i++) out.push(base)
  const soma = out.reduce((acc, v) => acc + v, 0)
  const delta = Number((valorTotal - soma).toFixed(2))
  out[qtd - 1] = Number((out[qtd - 1] + delta).toFixed(2))
  return out
}

export default function FinanceiroContratosPage() {
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [loadingParcelas, setLoadingParcelas] = useState(false)
  const [savingBaixa, setSavingBaixa] = useState(false)

  const [listaContratos, setListaContratos] = useState<Contrato[]>([])
  const [contratoId, setContratoId] = useState('')
  const [parcelasContrato, setParcelasContrato] = useState<ParcelaContrato[]>([])
  const [parcelasFinanceiro, setParcelasFinanceiro] = useState<ParcelaContrato[]>([])

  const [qtdParcelas, setQtdParcelas] = useState(3)
  const [primeiroVencimento, setPrimeiroVencimento] = useState('')
  const [formaEsperada, setFormaEsperada] = useState('PIX')
  const [observacaoPlano, setObservacaoPlano] = useState('')
  const [buscaContrato, setBuscaContrato] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'Pendente' | 'Recebido'>('todos')
  const [buscaFinanceiro, setBuscaFinanceiro] = useState('')

  const [draftParcelas, setDraftParcelas] = useState<ParcelaDraft[]>([])
  const [sugestaoComercial, setSugestaoComercial] = useState<{ qtd: number; dias: number; entradaPercent: number } | null>(null)

  const [baixaModal, setBaixaModal] = useState<ParcelaContrato | null>(null)
  const [baixaInput, setBaixaInput] = useState<BaixaParcelaInput>({
    valor_recebido: 0,
    data_pagamento: new Date().toISOString().slice(0, 10),
    forma_pagamento_realizada: 'PIX',
    observacoes: '',
  })

  const contratoSelecionado = useMemo(
    () => listaContratos.find(c => c.id === contratoId) || null,
    [listaContratos, contratoId],
  )

  const entradaPercentByContratoId = useMemo(() => {
    const out = new Map<string, number>()
    for (const contrato of listaContratos) {
      const comercial = parseComercialTag(contrato.observacoes)
      out.set(contrato.id, comercial?.entradaPercent || 0)
    }
    return out
  }, [listaContratos])

  const contratosFiltrados = useMemo(() => {
    const q = buscaContrato.toLowerCase().trim()
    if (!q) return listaContratos
    return listaContratos.filter(c => [
      c.nome_evento,
      c.empresa_nome,
      c.consultor,
      c.descricao,
      c.responsavel_empresa,
    ].some(v => String(v || '').toLowerCase().includes(q)))
  }, [buscaContrato, listaContratos])

  const parcelasFinanceiroVisiveis = useMemo(() => {
    const q = buscaFinanceiro.toLowerCase().trim()
    const filtradas = parcelasFinanceiro.filter(parcela => {
      if (!q) return true
      return (
        (parcela.contrato_nome_evento || '').toLowerCase().includes(q) ||
        (parcela.contrato_empresa_nome || '').toLowerCase().includes(q)
      )
    })

    const ordenadas = [...filtradas].sort((a, b) => {
      const contratoA = `${a.contrato_nome_evento || ''} ${a.contrato_empresa_nome || ''}`.toLowerCase()
      const contratoB = `${b.contrato_nome_evento || ''} ${b.contrato_empresa_nome || ''}`.toLowerCase()
      if (contratoA !== contratoB) return contratoA.localeCompare(contratoB, 'pt-BR')
      if (a.contrato_id !== b.contrato_id) return a.contrato_id.localeCompare(b.contrato_id)
      if (a.numero_parcela !== b.numero_parcela) return a.numero_parcela - b.numero_parcela
      return String(a.vencimento || '').localeCompare(String(b.vencimento || ''))
    })

    let lastContratoId = ''
    let groupIndex = -1

    return ordenadas.map(parcela => {
      if (parcela.contrato_id !== lastContratoId) {
        groupIndex += 1
        lastContratoId = parcela.contrato_id
      }

      return { parcela, groupIndex }
    })
  }, [buscaFinanceiro, parcelasFinanceiro])

  async function carregarBase() {
    setLoading(true)
    try {
      const [resContratos, resParcelas] = await Promise.all([
        contratos.listar({ allowGlobal: true }),
        financeiroContratos.listarParcelas(),
      ])

      // Apenas contratos com valor > 0 (exclui treinos/eventos gratuitos)
      // e com status financeiro relevante: aguardando pgto, confirmado ou finalizado
      const filtrados = (resContratos.data || []).filter(c => {
        const s = (c.status || '').toLowerCase()
        const valor = Number(c.valor_total || 0)
        const statusFinanceiro =
          s.includes('aguardando') ||
          s.includes('confirmado') ||
          s.includes('finalizado')
        return statusFinanceiro && valor > 0
      }).sort((a, b) => {
        const labelA = `${a.nome_evento || ''} ${a.empresa_nome || ''}`.toLowerCase()
        const labelB = `${b.nome_evento || ''} ${b.empresa_nome || ''}`.toLowerCase()
        return labelA.localeCompare(labelB, 'pt-BR')
      })
      setListaContratos(filtrados)
      setParcelasFinanceiro((resParcelas.data || []) as ParcelaContrato[])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar financeiro de contratos')
    } finally {
      setLoading(false)
    }
  }

  async function carregarParcelasContrato(id: string) {
    if (!id) {
      setParcelasContrato([])
      return
    }
    setLoadingParcelas(true)
    try {
      const res = await contratos.listarParcelas(id)
      const parcelas = (res.data || []) as ParcelaContrato[]
      setParcelasContrato(parcelas)
      if (parcelas.length > 0) {
        setDraftParcelas(
          parcelas
            .filter(p => (p.status || '').toLowerCase() !== 'recebido')
            .map(p => ({
              numero_parcela: p.numero_parcela,
              valor_previsto: Number(p.valor_previsto || 0),
              vencimento: normalizeDateInput(p.vencimento),
              forma_pagamento_esperada: p.forma_pagamento_esperada || formaEsperada,
              observacoes: p.observacoes || '',
            })),
        )
      } else {
        setDraftParcelas([])
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar parcelas do contrato')
      setParcelasContrato([])
    } finally {
      setLoadingParcelas(false)
    }
  }

  useEffect(() => {
    void carregarBase()
  }, [])

  useEffect(() => {
    if (contratoId) {
      void carregarParcelasContrato(contratoId)
    }
  }, [contratoId])

  // Auto-preenche Qtd. parcelas e sugere 1º vencimento com base na proposta comercial
  useEffect(() => {
    if (!contratoSelecionado) {
      setSugestaoComercial(null)
      return
    }
    const comercial = parseComercialTag(contratoSelecionado.observacoes)
    if (comercial) {
      setQtdParcelas(comercial.qtdParcelas)
      setPrimeiroVencimento(addDaysToToday(comercial.primeiroVencimentoDias))
      setSugestaoComercial({
        qtd: comercial.qtdParcelas,
        dias: comercial.primeiroVencimentoDias,
        entradaPercent: comercial.entradaPercent,
      })
    } else {
      setSugestaoComercial(null)
    }
  }, [contratoSelecionado])

  async function atualizarListaParcelasFinanceiro() {
    try {
      const res = await financeiroContratos.listarParcelas({ status: statusFiltro === 'todos' ? undefined : statusFiltro })
      setParcelasFinanceiro((res.data || []) as ParcelaContrato[])
    } catch {
      setParcelasFinanceiro([])
    }
  }

  useEffect(() => {
    void atualizarListaParcelasFinanceiro()
  }, [statusFiltro])

  function gerarPlano() {
    if (!contratoSelecionado) {
      toast.error('Selecione um contrato para gerar o plano')
      return
    }
    if (!primeiroVencimento) {
      toast.error('Informe o primeiro vencimento')
      return
    }

    const valorTotal = Number(contratoSelecionado.valor_total || 0)
    const qtd = Math.max(1, qtdParcelas)
    const comercial = parseComercialTag(contratoSelecionado.observacoes)

    let valores: number[] = []
    if (comercial && qtd > 1 && comercial.entradaPercent > 0 && comercial.entradaPercent < 100) {
      const entrada = Number(((valorTotal * comercial.entradaPercent) / 100).toFixed(2))
      const saldo = Number((valorTotal - entrada).toFixed(2))
      const saldoParcelas = dividirParcelas(saldo, Math.max(1, qtd - 1))
      valores = [entrada, ...saldoParcelas]
    } else {
      valores = dividirParcelas(valorTotal, qtd)
    }

    const baseDate = new Date(primeiroVencimento)
    if (Number.isNaN(baseDate.getTime())) {
      toast.error('Primeiro vencimento inválido')
      return
    }

    const novoDraft: ParcelaDraft[] = valores.map((valor, idx) => {
      const d = new Date(baseDate)
      d.setMonth(d.getMonth() + idx)
      return {
        numero_parcela: idx + 1,
        valor_previsto: valor,
        vencimento: d.toISOString().slice(0, 10),
        forma_pagamento_esperada: formaEsperada,
        observacoes: observacaoPlano,
      }
    })

    setDraftParcelas(novoDraft)
  }

  async function excluirPlano() {
    if (!contratoId) return
    if (!window.confirm('Excluir todas as parcelas pendentes deste contrato? Parcelas já recebidas são preservadas.')) return
    setExcluindo(true)
    try {
      await contratos.excluirParcelas(contratoId)
      toast.success('Plano excluído com sucesso')
      await Promise.all([carregarParcelasContrato(contratoId), atualizarListaParcelasFinanceiro()])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir plano')
    } finally {
      setExcluindo(false)
    }
  }

  async function salvarPlano() {
    if (!contratoId) {
      toast.error('Selecione um contrato')
      return
    }
    if (draftParcelas.length === 0) {
      toast.error('Gere ou preencha as parcelas antes de salvar')
      return
    }

    setSaving(true)
    try {
      await contratos.salvarParcelas(contratoId, draftParcelas)
      toast.success('Plano de parcelas salvo com sucesso')
      await Promise.all([carregarParcelasContrato(contratoId), atualizarListaParcelasFinanceiro()])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar plano de parcelas')
    } finally {
      setSaving(false)
    }
  }

  function abrirBaixa(parcela: ParcelaContrato) {
    setBaixaModal(parcela)
    setBaixaInput({
      valor_recebido: Number(parcela.valor_previsto || 0),
      data_pagamento: new Date().toISOString().slice(0, 10),
      forma_pagamento_realizada: parcela.forma_pagamento_esperada || 'PIX',
      observacoes: '',
    })

    const recebido = (parcela.status || '').toLowerCase() === 'recebido'
    if (recebido) {
      setBaixaInput({
        valor_recebido: Number(parcela.valor_recebido || parcela.valor_previsto || 0),
        data_pagamento: normalizeDateInput(parcela.data_pagamento) || new Date().toISOString().slice(0, 10),
        forma_pagamento_realizada: parcela.forma_pagamento_realizada || parcela.forma_pagamento_esperada || 'PIX',
        observacoes: parcela.observacoes || '',
      })
    }
  }

  async function confirmarBaixa() {
    if (!baixaModal) return
    setSavingBaixa(true)
    try {
      await financeiroContratos.baixarParcela(baixaModal.id, baixaInput)

      const nomeResponsavel = String(user?.nome || '').trim()
      if (nomeResponsavel) {
        setParcelasFinanceiro(prev => prev.map(item => item.id === baixaModal.id ? {
          ...item,
          status: 'Recebido',
          valor_recebido: Number(baixaInput.valor_recebido || item.valor_previsto || 0),
          data_pagamento: baixaInput.data_pagamento || item.data_pagamento,
          forma_pagamento_realizada: baixaInput.forma_pagamento_realizada || item.forma_pagamento_realizada,
          observacoes: baixaInput.observacoes || item.observacoes,
          baixado_por_nome: item.baixado_por_nome || nomeResponsavel,
        } : item))

        setParcelasContrato(prev => prev.map(item => item.id === baixaModal.id ? {
          ...item,
          status: 'Recebido',
          valor_recebido: Number(baixaInput.valor_recebido || item.valor_previsto || 0),
          data_pagamento: baixaInput.data_pagamento || item.data_pagamento,
          forma_pagamento_realizada: baixaInput.forma_pagamento_realizada || item.forma_pagamento_realizada,
          observacoes: baixaInput.observacoes || item.observacoes,
          baixado_por_nome: item.baixado_por_nome || nomeResponsavel,
        } : item))
      }

      toast.success('Baixa registrada com sucesso')
      setBaixaModal(null)
      await Promise.all([
        atualizarListaParcelasFinanceiro(),
        contratoId ? carregarParcelasContrato(contratoId) : Promise.resolve(),
      ])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar baixa')
    } finally {
      setSavingBaixa(false)
    }
  }

  const totalPrevisto = draftParcelas.reduce((acc, p) => acc + Number(p.valor_previsto || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#f25c05]" /> Financeiro de Contratos
          </h1>
          <p className="text-sm text-muted-foreground">Parcelamento, previsão e baixa manual de recebimentos corporativos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4 text-[#f25c05]" /> Plano de Parcelas por Contrato</CardTitle>
            <CardDescription>Monte e ajuste o cronograma de recebimento por contrato.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-1.5 xl:col-span-2">
                <Label>Contrato</Label>
                <Select value={contratoId} onValueChange={v => setContratoId(v ?? '')} onOpenChange={open => { if (!open) setBuscaContrato('') }}>
                  <SelectTrigger className="w-full">
                    <span className="truncate block max-w-full">
                      {contratoSelecionado ? `${contratoSelecionado.nome_evento} · ${contratoSelecionado.empresa_nome}` : 'Selecione'}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="w-[680px] max-w-[90vw]">
                    <div className="p-2 pb-1">
                      <Input
                        value={buscaContrato}
                        onChange={e => setBuscaContrato(e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        placeholder="Buscar contrato por evento/empresa..."
                        className="h-8 text-sm"
                        autoFocus
                      />
                    </div>
                    {contratosFiltrados.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum contrato encontrado.</div>
                    )}
                    {contratosFiltrados.map(c => {
                      const s = (c.status || '').toLowerCase()
                      const labelStatus = s.includes('finalizado') ? '✓ Finalizado' : s.includes('confirmado') ? '✓ Confirmado' : '⏳ Ag. PGTO'
                      const temPlano = parcelasFinanceiro.some(p => p.contrato_id === c.id)
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{c.nome_evento}{temPlano ? ' 📋' : ''}</span>
                            <span className="text-xs text-muted-foreground">{c.empresa_nome} · {labelStatus}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Qtd. parcelas</Label>
                <Input type="number" min={1} max={24} value={qtdParcelas} onChange={e => { setQtdParcelas(Math.max(1, Number(e.target.value || 1))); setSugestaoComercial(prev => prev ? { ...prev } : null) }} />
                {sugestaoComercial && (
                  <p className="text-xs text-blue-600">↑ da proposta ({sugestaoComercial.qtd}x totais). Editável.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>1º vencimento</Label>
                <Input type="date" value={primeiroVencimento} onChange={e => setPrimeiroVencimento(e.target.value)} />
                {sugestaoComercial ? (
                  <p className="text-xs text-blue-600">↑ hoje + {sugestaoComercial.dias} dias (D+{sugestaoComercial.dias} da proposta). Editável.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Data acordada na assinatura do contrato.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Forma esperada</Label>
                <Select value={formaEsperada} onValueChange={v => setFormaEsperada(v || 'PIX')}>
                  <SelectTrigger className="w-full">{formaEsperada}</SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Transferência">Transferência</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                    <SelectItem value="Cartão">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observação do plano</Label>
              <Input value={observacaoPlano} onChange={e => setObservacaoPlano(e.target.value)} placeholder="Ex.: entrada no fechamento + saldo até o evento" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={gerarPlano} disabled={loading || !contratoSelecionado}>Gerar plano automático</Button>
              <Button onClick={() => void salvarPlano()} disabled={!isAdmin || saving || draftParcelas.length === 0} className="bg-[#f25c05] hover:bg-[#d84f00] text-white">
                <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar plano'}
              </Button>
              {parcelasContrato.length > 0 && isAdmin && (
                <Button variant="outline" onClick={() => void excluirPlano()} disabled={excluindo} className="text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> {excluindo ? 'Excluindo...' : 'Excluir plano'}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Total do plano: {BRL.format(totalPrevisto)}</p>
            </div>

            {parcelasContrato.length > 0 && draftParcelas.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                ✏ Este contrato já tem plano salvo. Salvar substituirá as parcelas pendentes (as já recebidas são preservadas).
              </p>
            )}

            {(() => {
              if (!contratoSelecionado || !sugestaoComercial || sugestaoComercial.qtd <= 1) return null
              const total = Number(contratoSelecionado.valor_total || 0)
              const entradaValor = Number(((total * sugestaoComercial.entradaPercent) / 100).toFixed(2))
              const saldoValor = Number((total - entradaValor).toFixed(2))
              const saldoQtd = Math.max(1, sugestaoComercial.qtd - 1)
              const saldoMedia = Number((saldoValor / saldoQtd).toFixed(2))
              if (sugestaoComercial.entradaPercent <= 0 || sugestaoComercial.entradaPercent >= 100) return null
              return (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                  Regra da proposta: entrada de {sugestaoComercial.entradaPercent}% ({BRL.format(entradaValor)}) + saldo de {BRL.format(saldoValor)} em {saldoQtd} {saldoQtd === 1 ? 'parcela' : 'parcelas'} (aprox. {BRL.format(saldoMedia)} cada).
                </p>
              )
            })()}

            {(() => {
              const dataEvento = contratoSelecionado?.data_evento
              if (!dataEvento || draftParcelas.length === 0) return null
              const eventoStr = dataEvento.slice(0, 10)
              const parcelasAposEvento = draftParcelas.filter(p => p.vencimento && p.vencimento > eventoStr)
              if (parcelasAposEvento.length === 0) return null
              return (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  ⚠ {parcelasAposEvento.length === 1 ? '1 parcela vence' : `${parcelasAposEvento.length} parcelas vencem`} após a data do evento ({formatDate(eventoStr)}). Isso é normal quando o cliente fecha próximo ao evento.
                </p>
              )
            })()}

            <RTable>
              <RTableHeader>
                <RTableRow>
                  <RTableHead>Parcela</RTableHead>
                  <RTableHead>Vencimento</RTableHead>
                  <RTableHead>Forma</RTableHead>
                  <RTableHead className="text-right">Valor previsto</RTableHead>
                </RTableRow>
              </RTableHeader>
              <RTableBody>
                {loadingParcelas ? (
                  <RTableRow>
                    <RTableCell colSpan={4} className="py-7 text-center text-muted-foreground">Carregando parcelas do contrato...</RTableCell>
                  </RTableRow>
                ) : draftParcelas.length === 0 ? (
                  <RTableRow>
                    <RTableCell colSpan={4} className="py-7 text-center text-muted-foreground">Nenhuma parcela em edição.</RTableCell>
                  </RTableRow>
                ) : (
                  draftParcelas.map((p, idx) => (
                    <RTableRow key={`draft-${idx}`}>
                      <RTableCell>
                        {p.numero_parcela}
                        {p.numero_parcela === 1 && (sugestaoComercial?.entradaPercent || 0) > 0 ? ' (Entrada)' : ''}
                      </RTableCell>
                      <RTableCell>
                        <Input type="date" value={normalizeDateInput(p.vencimento)} onChange={e => setDraftParcelas(list => list.map((item, i) => i === idx ? { ...item, vencimento: e.target.value } : item))} />
                      </RTableCell>
                      <RTableCell>
                        <Input value={p.forma_pagamento_esperada || ''} onChange={e => setDraftParcelas(list => list.map((item, i) => i === idx ? { ...item, forma_pagamento_esperada: e.target.value } : item))} />
                      </RTableCell>
                      <RTableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={Number(p.valor_previsto || 0)}
                          onChange={e => setDraftParcelas(list => list.map((item, i) => i === idx ? { ...item, valor_previsto: Number(e.target.value || 0) } : item))}
                        />
                      </RTableCell>
                    </RTableRow>
                  ))
                )}
              </RTableBody>
            </RTable>

            {parcelasContrato.filter(p => (p.status || '').toLowerCase() === 'recebido').length > 0 && (
              <p className="text-xs text-muted-foreground">Parcelas já recebidas permanecem preservadas automaticamente.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><HandCoins className="h-4 w-4 text-[#f25c05]" /> Resumo do Contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Evento</p>
              <p className="font-semibold">{contratoSelecionado?.nome_evento || '-'}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Data do evento</p>
              <p className="font-semibold">{formatDate(contratoSelecionado?.data_evento)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Empresa</p>
              <p className="font-semibold">{contratoSelecionado?.empresa_nome || '-'}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Valor contratado</p>
              <p className="font-semibold">{BRL.format(Number(contratoSelecionado?.valor_total || 0))}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Valor recebido</p>
              <p className="font-semibold">{BRL.format(Number(contratoSelecionado?.valor_pago || 0))}</p>
            </div>
            {!isAdmin && <p className="text-xs text-muted-foreground">Seu perfil é somente consulta para salvar e dar baixa.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Parcelas no Financeiro</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Buscar evento ou empresa..."
              value={buscaFinanceiro}
              onChange={e => setBuscaFinanceiro(e.target.value)}
              className="w-52 h-9 text-sm"
            />
            <Select value={statusFiltro} onValueChange={v => setStatusFiltro((v as 'todos' | 'Pendente' | 'Recebido') || 'todos')}>
              <SelectTrigger className="w-[180px]">
                {statusFiltro === 'todos' ? 'Todos os status' : statusFiltro}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Recebido">Recebido</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void atualizarListaParcelasFinanceiro()} disabled={loading}>Atualizar</Button>
          </div>
        </CardHeader>
        <CardContent>
          <RTable>
            <RTableHeader>
              <RTableRow>
                <RTableHead className="w-[33%] pr-4">Evento / Empresa</RTableHead>
                <RTableHead className="w-[10%] pr-4">Parcela</RTableHead>
                <RTableHead className="w-[12%] pr-4">Vencimento</RTableHead>
                <RTableHead className="w-[12%] pr-4">Status</RTableHead>
                <RTableHead className="w-[11%] pr-4">Previsto</RTableHead>
                <RTableHead className="w-[11%] pr-4">Recebido</RTableHead>
                <RTableHead className="w-[11%] pr-4">Data baixa</RTableHead>
                <RTableHead className="w-[12%]">Ação</RTableHead>
              </RTableRow>
            </RTableHeader>
            <RTableBody>
              {loading ? (
                <RTableRow>
                  <RTableCell colSpan={8} className="py-8 text-center text-muted-foreground">Carregando...</RTableCell>
                </RTableRow>
              ) : parcelasFinanceiroVisiveis.length === 0 ? (
                <RTableRow>
                  <RTableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhuma parcela encontrada para a busca.</RTableCell>
                </RTableRow>
              ) : (
                parcelasFinanceiroVisiveis.map(({ parcela, groupIndex }) => {
                  const recebido = (parcela.status || '').toLowerCase() === 'recebido'
                  const isEntrada = parcela.numero_parcela === 1 && (entradaPercentByContratoId.get(parcela.contrato_id) || 0) > 0
                  return (
                    <RTableRow key={parcela.id} className={groupIndex % 2 === 1 ? 'bg-muted/30' : ''}>
                      <RTableCell className="align-middle">
                        <p className="font-medium">{parcela.contrato_nome_evento || '-'}</p>
                        <p className="text-xs text-muted-foreground">{parcela.contrato_empresa_nome || '-'}</p>
                      </RTableCell>
                      <RTableCell className="align-middle">
                        {parcela.numero_parcela}
                        {isEntrada ? ' (Entrada)' : ''}
                      </RTableCell>
                      <RTableCell className="align-middle">{formatDate(parcela.vencimento)}</RTableCell>
                      <RTableCell className="align-middle">
                        {recebido ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Recebido</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Pendente</Badge>
                        )}
                      </RTableCell>
                      <RTableCell className="align-middle tabular-nums">{BRL.format(Number(parcela.valor_previsto || 0))}</RTableCell>
                      <RTableCell className="align-middle tabular-nums">{BRL.format(Number(parcela.valor_recebido || 0))}</RTableCell>
                      <RTableCell className="align-middle">{formatDate(parcela.data_pagamento)}</RTableCell>
                      <RTableCell className="align-middle">
                        {recebido ? (
                          <div className="inline-flex items-center gap-2 whitespace-nowrap">
                            <span className="inline-flex items-center text-xs text-emerald-700 gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Baixado</span>
                            <Button size="icon" variant="outline" onClick={() => abrirBaixa(parcela)} disabled={!isAdmin} aria-label="Editar baixa">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => abrirBaixa(parcela)} disabled={!isAdmin} className="bg-[#f25c05] hover:bg-[#d84f00] text-white">Dar baixa</Button>
                        )}
                      </RTableCell>
                    </RTableRow>
                  )
                })
              )}
            </RTableBody>
          </RTable>
        </CardContent>
      </Card>

      <Dialog open={Boolean(baixaModal)} onOpenChange={open => !open && setBaixaModal(null)}>
        <DialogContent className="w-[92vw] max-w-[720px]">
          <DialogHeader>
            <DialogTitle>
              {(baixaModal?.status || '').toLowerCase() === 'recebido' ? 'Editar baixa de pagamento' : 'Registrar baixa de pagamento'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground md:grid-cols-2">
              <p>
                <span className="font-semibold text-foreground">Parcela:</span> {baixaModal?.numero_parcela || '-'}
              </p>
              <p>
                <span className="font-semibold text-foreground">Registrado por:</span>{' '}
                {(baixaModal?.baixado_por_nome || '').trim() || (((baixaModal?.status || '').toLowerCase() === 'recebido') ? 'Não informado (registro antigo)' : 'Ainda não registrado')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Valor recebido</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={Number(baixaInput.valor_recebido || 0)}
                onChange={e => setBaixaInput(prev => ({ ...prev, valor_recebido: Number(e.target.value || 0) }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Data de pagamento</Label>
              <Input
                type="date"
                value={baixaInput.data_pagamento || ''}
                onChange={e => setBaixaInput(prev => ({ ...prev, data_pagamento: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Forma de pagamento realizada</Label>
              <Select
                value={baixaInput.forma_pagamento_realizada || 'PIX'}
                onValueChange={v => setBaixaInput(prev => ({ ...prev, forma_pagamento_realizada: v || 'PIX' }))}
              >
                <SelectTrigger className="w-full">{baixaInput.forma_pagamento_realizada || 'PIX'}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Cartão">Cartão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input
                value={baixaInput.observacoes || ''}
                onChange={e => setBaixaInput(prev => ({ ...prev, observacoes: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBaixaModal(null)}>Cancelar</Button>
              <Button onClick={() => void confirmarBaixa()} disabled={savingBaixa || !isAdmin} className="bg-[#f25c05] hover:bg-[#d84f00] text-white">
                {savingBaixa ? 'Salvando...' : 'Confirmar baixa'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
