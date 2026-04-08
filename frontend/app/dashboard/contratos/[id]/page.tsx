'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { contratos, participantes, Contrato, Participante } from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import { ArrowLeft, Trash2, Copy, ExternalLink } from 'lucide-react'

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ContratoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backHref = from === 'dashboard' ? '/dashboard' : '/dashboard/contratos'
  const [evento, setEvento] = useState<Contrato | null>(null)
  const [parts, setParts] = useState<Participante[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  useEffect(() => {
    Promise.all([contratos.buscar(id), participantes.listarPorContrato(id)])
      .then(([c, p]) => {
        setEvento(c.data as Contrato)
        setParts(p.data as Participante[])
      })
      .catch(() => toast.error('Erro ao carregar evento'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    setDeleting(true)
    try {
      await contratos.deletar(id)
      toast.success('Evento removido')
      router.push('/dashboard/contratos')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover')
    } finally {
      setDeleting(false)
    }
  }

  const publicFormUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/publico/orcamento`
    : '/publico/orcamento'

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!evento) return <p className="text-muted-foreground">Evento não encontrado.</p>

  const qtdInscritos = Number(evento.qtd_inscritos || 0)
  const qtdContratada = Number(evento.qtd_contratada || 0)
  const pct = qtdContratada > 0 ? Math.round((qtdInscritos / qtdContratada) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link href={backHref} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{evento.nome_evento}</h1>
          <p className="text-sm text-muted-foreground">
            {evento.empresa_nome} · {evento.consultor}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(publicFormUrl)
              toast.success('Link copiado!')
            }}
          >
            <Copy className="h-4 w-4 mr-1" /> Link Formulario p/ Cliente
          </Button>
          <Button variant="destructive" size="sm" disabled={deleting} onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Confirmar exclusão"
        description="Isso removerá o evento e todos os participantes. Ação irreversível."
        confirmLabel="Confirmar exclusão"
        confirmDisabled={deleting}
        destructive
        onConfirm={handleDelete}
      />

      {/* Dados do evento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Status">
              <Badge variant="outline">{evento.status}</Badge>
            </Row>
            <Row label="Data">{evento.data_evento ? new Date(evento.data_evento).toLocaleDateString('pt-BR') : '—'}</Row>
            <Row label="Local">{evento.local_nome}</Row>
            <Row label="Modalidade">{evento.modalidade}</Row>
            <Row label="KM">{evento.km}</Row>
            <Row label="Descrição">{evento.descricao}</Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financeiro e vagas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Valor total">{moeda(evento.valor_total)}</Row>
            <Row label="Valor pago">{moeda(evento.valor_pago)}</Row>
            <Row label="Vagas">
              <span className={pct >= 90 ? 'text-red-600 font-semibold' : ''}>
                {qtdInscritos}/{qtdContratada} ({pct}%)
              </span>
            </Row>
            <Row label="Kit">{evento.possui_kit ? `Sim — ${evento.tipo_kit}` : 'Não'}</Row>
            {evento.pix_copia_cola && (
              <Row label="PIX">
                <button
                  className="text-primary underline text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(evento.pix_copia_cola)
                    toast.success('PIX copiado!')
                  }}
                >
                  Copiar copia-e-cola
                </button>
              </Row>
            )}
            {evento.link_gateway && (
              <Row label="Gateway">
                <a
                  href={evento.link_gateway}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary flex items-center gap-1"
                >
                  Acessar <ExternalLink className="h-3 w-3" />
                </a>
              </Row>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Participantes */}
      <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 shadow-none md:gap-4 md:overflow-hidden md:bg-card md:py-4 md:ring-1 md:shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Participantes ({parts.length})
          </CardTitle>
          <a href={publicFormUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <ExternalLink className="h-4 w-4 mr-1" /> Abrir Formulario Comercial
          </a>
        </CardHeader>
        <CardContent className="p-0">
          {parts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum participante inscrito ainda
            </p>
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
