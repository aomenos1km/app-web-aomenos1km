'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { contratos, participantes, type Contrato, type Participante } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { RTable, RTableBody, RTableCell, RTableHead, RTableHeader, RTableRow } from '@/components/ui/responsive-table'

type DetailTab = 'resumo' | 'participantes' | 'financeiro'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Props = {
  open: boolean
  contratoId: string | null
  onOpenChange: (open: boolean) => void
}

function parseDescricaoContrato(raw?: string) {
  const text = String(raw || '').trim()
  if (!text) return 'Sem descrição'
  const cleaned = text.replace(/\[origem:[^\]]+\]/gi, '').replace(/\s+/g, ' ').trim()
  return cleaned || 'Sem descrição'
}

function formatDate(value?: string) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

function formatDateLong(value?: string) {
  if (!value) return 'Data não informada'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function getStatusBadgeClass(status: string) {
  const s = status.toLowerCase()
  if (s.includes('confirm')) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (s.includes('negoc')) return 'bg-amber-100 text-amber-800 border-amber-200'
  if (s.includes('cancel')) return 'bg-rose-100 text-rose-800 border-rose-200'
  if (s.includes('conclu') || s.includes('final')) return 'bg-violet-100 text-violet-800 border-violet-200'
  return 'bg-blue-100 text-blue-800 border-blue-200'
}

export function ContratoDetalhesModal({
  open,
  contratoId,
  onOpenChange,
}: Props) {
  const [detailTab, setDetailTab] = useState<DetailTab>('resumo')
  const [evento, setEvento] = useState<Contrato | null>(null)
  const [parts, setParts] = useState<Participante[]>([])

  useEffect(() => {
    if (!open || !contratoId) return

    let active = true

    Promise.all([contratos.buscar(contratoId), participantes.listarPorContrato(contratoId)])
      .then(([c, p]) => {
        if (!active) return
        setEvento((c.data || null) as Contrato | null)
        setParts((p.data || []) as Participante[])
      })
      .catch(() => {
        if (!active) return
        toast.error('Erro ao carregar detalhes do contrato')
        setEvento(null)
        setParts([])
      })

    return () => {
      active = false
    }
  }, [open, contratoId])

  const loading = open && Boolean(contratoId) && evento?.id !== contratoId

  const taxaOcupacao = useMemo(() => {
    const vagas = Number(evento?.qtd_contratada || 0)
    const inscritos = parts.length
    const pct = vagas > 0 ? Math.round((inscritos / vagas) * 100) : 0
    return `${inscritos}/${vagas} (${pct}%)`
  }, [evento?.qtd_contratada, parts.length])

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          setEvento(null)
          setParts([])
          setDetailTab('resumo')
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8">{evento?.nome_evento || 'Detalhes do contrato'}</DialogTitle>
          <DialogDescription>{formatDateLong(evento?.data_evento)}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
        ) : !evento ? (
          <p className="text-sm text-muted-foreground">Contrato não encontrado.</p>
        ) : (
          <>
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
                  Participantes ({parts.length})
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
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Informações gerais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Row label="Status">
                      <Badge variant="outline" className={getStatusBadgeClass(evento.status || '')}>
                        {evento.status || '-'}
                      </Badge>
                    </Row>
                    <Row label="Data">{formatDate(evento.data_evento)}</Row>
                    <Row label="Local">{evento.local_nome || '—'}</Row>
                    <Row label="Modalidade">{evento.modalidade || '—'}</Row>
                    <Row label="KM">{evento.km || '—'}</Row>
                    <Row label="Consultor">{evento.consultor || '—'}</Row>
                    <Row label="Cliente">{evento.empresa_nome || '—'}</Row>
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground">Descrição</p>
                      <p className="text-right font-medium">{parseDescricaoContrato(evento.descricao)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resumo operacional</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Row label="Participantes inscritos">{parts.length}</Row>
                    <Row label="Vagas contratadas">{Number(evento.qtd_contratada || 0)}</Row>
                    <Row label="Valor total">{BRL.format(Number(evento.valor_total || 0))}</Row>
                    <Row label="Valor pago">{BRL.format(Number(evento.valor_pago || 0))}</Row>
                  </CardContent>
                </Card>
              </div>
            )}

            {detailTab === 'participantes' && (
              <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 shadow-none md:gap-4 md:overflow-hidden md:bg-card md:py-4 md:ring-1 md:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Participantes ({parts.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {parts.length === 0 ? (
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
                          {parts.map(p => (
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
                                    (p.status_pagamento || '').toLowerCase() === 'pago'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }
                                >
                                  {p.status_pagamento}
                                </Badge>
                              </RTableCell>
                              <RTableCell className="text-xs text-muted-foreground">{formatDate(p.data_inscricao)}</RTableCell>
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
                  <Row label="Valor total">{BRL.format(Number(evento.valor_total || 0))}</Row>
                  <Row label="Valor pago">{BRL.format(Number(evento.valor_pago || 0))}</Row>
                  <Row label="Participantes inscritos">{parts.length}</Row>
                  <Row label="Vagas contratadas">{Number(evento.qtd_contratada || 0)}</Row>
                  <Row label="Taxa de ocupação">{taxaOcupacao}</Row>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
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
