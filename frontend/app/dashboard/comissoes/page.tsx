'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, CircleDollarSign, Clock3, HandCoins, RefreshCcw } from 'lucide-react'
import { comissoes, usuariosEquipe, type ComissaoExtratoItem, type UsuarioEquipe } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { RTable, RTableBody, RTableCell, RTableHead, RTableHeader, RTableRow } from '@/components/ui/responsive-table'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatDate(value?: string | null): string {
  if (!value) return '-'
  const dateOnly = value.slice(0, 10)
  const [year, month, day] = dateOnly.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export default function ComissoesPage() {
  const { user, isAdmin } = useAuth()

  const now = new Date()
  const [ano, setAno] = useState(String(now.getFullYear()))
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [consultor, setConsultor] = useState('todos')

  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [itens, setItens] = useState<ComissaoExtratoItem[]>([])
  const [consultores, setConsultores] = useState<UsuarioEquipe[]>([])

  const [selectedContratoId, setSelectedContratoId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const selectedItem = useMemo(
    () => itens.find(item => item.contrato_id === selectedContratoId) ?? null,
    [itens, selectedContratoId],
  )

  const resumo = useMemo(() => {
    let totalPendente = 0
    let totalPago = 0
    let pendentes = 0
    let pagos = 0
    let minhaComissao = 0

    for (const item of itens) {
      if ((item.comissao_status || 'Pendente').toLowerCase() === 'pago') {
        totalPago += item.valor_comissao
        pagos++
      } else {
        totalPendente += item.valor_comissao
        pendentes++
      }

      if ((item.consultor || '').trim().toLowerCase() === (user?.nome || '').trim().toLowerCase()) {
        minhaComissao += item.valor_comissao
      }
    }

    return {
      totalPendente,
      totalPago,
      pendentes,
      pagos,
      minhaComissao,
    }
  }, [itens, user?.nome])

  async function carregarConsultores() {
    if (!isAdmin) return
    try {
      const res = await usuariosEquipe.listar()
      const data = (res.data || []).filter(u => u.perfil === 'Consultor' && u.ativo)
      setConsultores(data)
    } catch {
      setConsultores([])
    }
  }

  async function carregarExtrato() {
    setLoading(true)
    try {
      const res = await comissoes.listarExtrato({
        ano,
        mes,
        consultor: isAdmin && consultor !== 'todos' ? consultor : undefined,
      })
      setItens(res.data?.itens || [])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar extrato de comissões')
      setItens([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregarConsultores()
  }, [isAdmin])

  useEffect(() => {
    void carregarExtrato()
  }, [ano, mes, consultor, refreshKey])

  useEffect(() => {
    const bump = () => setRefreshKey(k => k + 1)
    const onVisible = () => { if (!document.hidden) bump() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('aomenos-refresh', bump)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('aomenos-refresh', bump)
    }
  }, [])

  async function confirmarBaixa() {
    if (!selectedContratoId || !selectedItem) return
    if (!isAdmin) {
      toast.error('Somente Administrador pode dar baixa de comissão')
      return
    }

    setSalvando(true)
    try {
      await comissoes.marcarPago(selectedContratoId)
      toast.success(`Comissão de ${selectedItem.consultor || 'consultor'} marcada como paga`) 
      setSelectedContratoId(null)
      await carregarExtrato()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível dar baixa na comissão')
    } finally {
      setSalvando(false)
    }
  }

  const anoOptions = useMemo(() => {
    const start = now.getFullYear() - 2
    const end = now.getFullYear() + 1
    const list: string[] = []
    for (let y = end; y >= start; y--) list.push(String(y))
    return list
  }, [now])

  const mesOptions = [
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-[#f25c05]" /> Comissões
          </h1>
          <p className="text-sm text-muted-foreground">Baixa manual de pagamentos por contrato (controle interno)</p>
        </div>
        <Button variant="outline" onClick={() => void carregarExtrato()}>
          <RefreshCcw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Total pendente</CardDescription>
            <CardTitle className="text-xl">{BRL.format(resumo.totalPendente)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" /> {resumo.pendentes} registro(s)
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Total pago</CardDescription>
            <CardTitle className="text-xl">{BRL.format(resumo.totalPago)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> {resumo.pagos} registro(s)
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Minha comissão (período)</CardDescription>
            <CardTitle className="text-xl">{BRL.format(resumo.minhaComissao)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-1">
            <CircleDollarSign className="h-3.5 w-3.5" /> Visão do usuário logado
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Ações de baixa</CardDescription>
            <CardTitle className="text-xl">{isAdmin ? 'Liberadas' : 'Somente Admin'}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {isAdmin ? 'Você pode registrar pagamento manual.' : 'Seu perfil é somente consulta.'}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 shadow-none md:gap-4 md:overflow-hidden md:bg-card md:py-4 md:ring-1 md:shadow-sm">
        <CardContent className="pt-5 space-y-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Select value={mes} onValueChange={v => setMes(v ?? mes)}>
              <SelectTrigger className="w-full">{mesOptions.find(m => m.value === mes)?.label || 'Mês'}</SelectTrigger>
              <SelectContent>
                {mesOptions.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={ano} onValueChange={v => setAno(v ?? ano)}>
              <SelectTrigger className="w-full">{ano}</SelectTrigger>
              <SelectContent>
                {anoOptions.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={consultor} onValueChange={v => setConsultor(v ?? 'todos')}>
              <SelectTrigger className="w-full">{consultor === 'todos' ? 'Todos os consultores' : consultor}</SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os consultores</SelectItem>
                {consultores.map(c => (
                  <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-xs text-muted-foreground flex items-center">
              {isAdmin ? 'Filtros completos habilitados para Administrador.' : 'Consultor visualiza somente os próprios contratos.'}
            </div>
          </div>

          <RTable>
            <RTableHeader>
              <RTableRow>
                <RTableHead>Data</RTableHead>
                <RTableHead>Evento / Empresa</RTableHead>
                <RTableHead>Consultor</RTableHead>
                <RTableHead>Status</RTableHead>
                <RTableHead className="text-right">Venda</RTableHead>
                <RTableHead className="text-right">%</RTableHead>
                <RTableHead className="text-right">Comissão</RTableHead>
                <RTableHead mobileLabel="" className="text-right">Ações</RTableHead>
              </RTableRow>
            </RTableHeader>
            <RTableBody>
              {loading ? (
                <RTableRow>
                  <RTableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando extrato...</RTableCell>
                </RTableRow>
              ) : itens.length === 0 ? (
                <RTableRow>
                  <RTableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma comissão encontrada para o filtro selecionado.</RTableCell>
                </RTableRow>
              ) : (
                itens.map(item => {
                  const pago = (item.comissao_status || '').toLowerCase() === 'pago'
                  return (
                    <RTableRow key={item.contrato_id}>
                      <RTableCell>{formatDate(item.data_evento)}</RTableCell>
                      <RTableCell>
                        <div className="font-medium">{item.nome_evento || '-'}</div>
                        <div className="text-xs text-muted-foreground">{item.empresa_nome || '-'}</div>
                      </RTableCell>
                      <RTableCell>{item.consultor || '-'}</RTableCell>
                      <RTableCell>
                        {pago ? (
                          <Badge variant="secondary">Pago</Badge>
                        ) : (
                          <Badge variant="outline">Pendente</Badge>
                        )}
                      </RTableCell>
                      <RTableCell className="text-right tabular-nums">{BRL.format(item.valor_venda || 0)}</RTableCell>
                      <RTableCell className="text-right tabular-nums">{Number(item.comissao_percent || 0).toFixed(2)}%</RTableCell>
                      <RTableCell className="text-right tabular-nums font-medium">{BRL.format(item.valor_comissao || 0)}</RTableCell>
                      <RTableCell className="text-right">
                        {pago ? (
                          <span className="text-xs text-muted-foreground">Baixado</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setSelectedContratoId(item.contrato_id)}
                            disabled={!isAdmin}
                            className="bg-[#f25c05] hover:bg-[#d84f00] text-white"
                          >
                            Pagar
                          </Button>
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

      <ConfirmDialog
        open={Boolean(selectedContratoId)}
        onOpenChange={open => {
          if (!open) setSelectedContratoId(null)
        }}
        title="Confirmar baixa da comissão"
        description="Essa ação registra a comissão como paga. Apenas Administrador pode executar."
        onConfirm={() => void confirmarBaixa()}
        confirmLabel={salvando ? 'Salvando...' : 'Confirmar pagamento'}
        confirmDisabled={!isAdmin || salvando}
      />
    </div>
  )
}
