'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, CircleDollarSign, Clock3, Eye, HandCoins, RefreshCcw } from 'lucide-react'
import { comissoes, contratos, participantes, usuariosEquipe, type ComissaoExtratoItem, type Contrato, type Participante, type UsuarioEquipe } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { RTable, RTableBody, RTableCell, RTableHead, RTableHeader, RTableRow } from '@/components/ui/responsive-table'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
type DetailTab = 'resumo' | 'participantes' | 'financeiro'

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
  const [viewContratoId, setViewContratoId] = useState<string | null>(null)
  const [viewContrato, setViewContrato] = useState<Contrato | null>(null)
  const [viewParts, setViewParts] = useState<Participante[]>([])
  const [viewLoading, setViewLoading] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('resumo')
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

  useEffect(() => {
    if (!viewContratoId) {
      setViewContrato(null)
      setViewParts([])
      setViewLoading(false)
      return
    }

    setViewLoading(true)
    Promise.all([contratos.buscar(viewContratoId), participantes.listarPorContrato(viewContratoId)])
      .then(([contratoRes, participantesRes]) => {
        setViewContrato((contratoRes.data || null) as Contrato | null)
        setViewParts((participantesRes.data || []) as Participante[])
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível carregar os detalhes do contrato')
        setViewContrato(null)
        setViewParts([])
      })
      .finally(() => setViewLoading(false))
  }, [viewContratoId])

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
                <RTableHead>Data de Baixa</RTableHead>
                <RTableHead className="text-right">Venda</RTableHead>
                <RTableHead className="text-right">%</RTableHead>
                <RTableHead className="text-right">Comissão</RTableHead>
                <RTableHead mobileLabel="" className="text-right">Ações</RTableHead>
              </RTableRow>
            </RTableHeader>
            <RTableBody>
              {loading ? (
                <RTableRow>
                  <RTableCell colSpan={9} className="text-center text-muted-foreground py-8">Carregando extrato...</RTableCell>
                </RTableRow>
              ) : itens.length === 0 ? (
                <RTableRow>
                  <RTableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma comissão encontrada para o filtro selecionado.</RTableCell>
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
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Pago</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Pendente</Badge>
                        )}
                      </RTableCell>
                      <RTableCell className="text-sm text-muted-foreground">
                        {pago ? formatDate(item.comissao_data_pagamento) : '-'}
                      </RTableCell>
                      <RTableCell className="text-right tabular-nums">{BRL.format(item.valor_venda || 0)}</RTableCell>
                      <RTableCell className="text-right tabular-nums">{Number(item.comissao_percent || 0).toFixed(2)}%</RTableCell>
                      <RTableCell className="text-right tabular-nums font-medium">{BRL.format(item.valor_comissao || 0)}</RTableCell>
                      <RTableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDetailTab('resumo')
                              setViewContratoId(item.contrato_id)
                            }}
                            title="Visualizar contrato"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {pago ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Baixado
                            </Badge>
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
                        </div>
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

      <Dialog
        open={Boolean(viewContratoId)}
        onOpenChange={open => {
          if (!open) {
            setViewContratoId(null)
            setDetailTab('resumo')
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8">{viewContrato?.nome_evento || 'Detalhes do contrato'}</DialogTitle>
          </DialogHeader>

          {viewLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          ) : !viewContrato ? (
            <p className="text-sm text-muted-foreground">Contrato não encontrado.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{formatDate(viewContrato.data_evento)}</p>

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
                    Participantes ({viewParts.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={detailTab === 'financeiro' ? 'default' : 'ghost'}
                    onClick={() => setDetailTab('financeiro')}
                  >
                    Financeiro
                  </Button>
                </div>
              </div>

              {detailTab === 'resumo' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Informações gerais</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <ModalRow label="Status">
                        <Badge variant="outline">{viewContrato.status || '-'}</Badge>
                      </ModalRow>
                      <ModalRow label="Data">{formatDate(viewContrato.data_evento)}</ModalRow>
                      <ModalRow label="Local">{viewContrato.local_nome || '-'}</ModalRow>
                      <ModalRow label="Modalidade">{viewContrato.modalidade || '-'}</ModalRow>
                      <ModalRow label="KM">{viewContrato.km || '-'}</ModalRow>
                      <ModalRow label="Consultor">{viewContrato.consultor || '-'}</ModalRow>
                      <ModalRow label="Cliente">{viewContrato.empresa_nome || '-'}</ModalRow>
                      <ModalRow label="Descrição">{viewContrato.descricao || '-'}</ModalRow>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Resumo operacional</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <ModalRow label="Participantes inscritos">{viewParts.length}</ModalRow>
                      <ModalRow label="Vagas contratadas">{Number(viewContrato.qtd_contratada || 0)}</ModalRow>
                      <ModalRow label="Valor total">{BRL.format(Number(viewContrato.valor_total || 0))}</ModalRow>
                    </CardContent>
                  </Card>
                </div>
              )}

              {detailTab === 'participantes' && (
                <Card className="gap-0 overflow-hidden py-4 ring-1 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Participantes ({viewParts.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {viewParts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum participante inscrito ainda.</p>
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
                            {viewParts.map(parte => (
                              <RTableRow key={parte.id}>
                                <RTableCell className="font-medium">{parte.nome || '-'}</RTableCell>
                                <RTableCell>{parte.whatsapp || '-'}</RTableCell>
                                <RTableCell className="font-mono text-xs">{parte.cpf || '-'}</RTableCell>
                                <RTableCell>{parte.modalidade || '-'}</RTableCell>
                                <RTableCell>{parte.tamanho_camiseta || '-'}</RTableCell>
                                <RTableCell>
                                  <Badge
                                    variant="outline"
                                    className={
                                      (parte.status_pagamento || '').toLowerCase() === 'pago'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }
                                  >
                                    {parte.status_pagamento || '-'}
                                  </Badge>
                                </RTableCell>
                                <RTableCell className="text-xs text-muted-foreground">{formatDate(parte.data_inscricao)}</RTableCell>
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
                    <ModalRow label="Valor total">{BRL.format(Number(viewContrato.valor_total || 0))}</ModalRow>
                    <ModalRow label="Valor pago">{BRL.format(Number(viewContrato.valor_pago || 0))}</ModalRow>
                    <ModalRow label="Participantes inscritos">{viewParts.length}</ModalRow>
                    <ModalRow label="Vagas contratadas">{Number(viewContrato.qtd_contratada || 0)}</ModalRow>
                    <ModalRow label="Taxa de ocupação">
                      {(() => {
                        const vagas = Number(viewContrato.qtd_contratada || 0)
                        const pct = vagas > 0 ? Math.round((viewParts.length / vagas) * 100) : 0
                        return `${viewParts.length}/${vagas} (${pct}%)`
                      })()}
                    </ModalRow>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ModalRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}
