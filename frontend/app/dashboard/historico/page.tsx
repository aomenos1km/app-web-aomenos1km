'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { contratos, participantes, type Contrato, type Participante } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RTable, RTableBody, RTableCell, RTableHead, RTableHeader, RTableRow } from '@/components/ui/responsive-table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Building2,
  Cake,
  Camera,
  CalendarDays,
  CirclePlus,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Flag,
  Handshake,
  History,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'

type HistoricoModo = 'corporativo' | 'proprio'
type HistoricoTab = 'dados' | 'treino' | 'perfil'
type OrigemFiltro = 'todas' | 'instagram' | 'indicacao' | 'outros'

const ITENS_POR_PAGINA = 10

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function empresaEhAomenos1km(nome: string) {
  const normalized = normalizeText(nome).replace(/[^a-z0-9]/g, '')
  return normalized.includes('aomenos1km')
}

function isEventoRealizado(dataEvento?: string | null) {
  if (!dataEvento) return false
  const data = new Date(dataEvento)
  if (Number.isNaN(data.getTime())) return false
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  data.setHours(0, 0, 0, 0)
  return data <= hoje
}

function formatDateBR(value?: string | null) {
  if (!value) return '--/--/----'
  const data = new Date(value)
  if (Number.isNaN(data.getTime())) return '--/--/----'
  return data.toLocaleDateString('pt-BR')
}

function boolLabel(value?: boolean) {
  return value ? 'Sim' : 'Não'
}

function whatsappLink(numero: string) {
  const digits = String(numero || '').replace(/\D/g, '')
  if (!digits) return ''
  const withCC = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
  return `https://wa.me/${withCC}`
}

function mailtoLink(email: string) {
  const value = String(email || '').trim()
  return value ? `mailto:${value}` : ''
}

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function sanitizeFileName(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getEventoLabel(evento: Contrato) {
  const nomeEvento = String(evento.nome_evento || '').trim()
  const empresaNome = String(evento.empresa_nome || '').trim()
  const nomeBase = nomeEvento || empresaNome || 'Evento sem nome'
  return `${formatDateBR(evento.data_evento)} - ${nomeBase}`
}

function getNivelParticipante(participante: Participante) {
  return participante.modalidade_distancia || participante.modalidade || '-'
}

function getOrigemLead(comoConheceu?: string) {
  const origem = normalizeText(comoConheceu || '')
  if (origem.includes('instagram')) return 'instagram'
  if (origem.includes('indic')) return 'indicacao'
  return 'outros'
}

function downloadExcelXml(filename: string, sheetName: string, headers: string[], rows: Array<Array<string | number>>) {
  const safeSheet = escapeXml(sheetName).slice(0, 31) || 'Planilha'
  const headerXml = headers
    .map(header => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`)
    .join('')
  const rowsXml = rows
    .map(row => {
      const cells = row
        .map(value => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`)
        .join('')
      return `<Row>${cells}</Row>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${safeSheet}">
  <Table>
   <Row>${headerXml}</Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`

  const blob = new Blob([`\ufeff${xml}`], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function HistoricoPage() {
  const { isAdmin, loading: authLoading } = useAuth()

  const [modo, setModo] = useState<HistoricoModo>('corporativo')
  const [loadingEventos, setLoadingEventos] = useState(true)
  const [loadingParticipantes, setLoadingParticipantes] = useState(false)
  const [filtroEvento, setFiltroEvento] = useState('')
  const [buscaTabela, setBuscaTabela] = useState('')
  const [origemFiltro, setOrigemFiltro] = useState<OrigemFiltro>('todas')
  const [somenteQuentes, setSomenteQuentes] = useState(false)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [eventos, setEventos] = useState<Contrato[]>([])
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState('')
  const [listaParticipantes, setListaParticipantes] = useState<Participante[]>([])
  const [participanteSelecionado, setParticipanteSelecionado] = useState<Participante | null>(null)
  const [abaModal, setAbaModal] = useState<HistoricoTab>('dados')

  useEffect(() => {
    let ativo = true
    setLoadingEventos(true)

    contratos
      .listar()
      .then(response => {
        if (!ativo) return
        const historico = (response.data ?? [])
          .filter(evento => isEventoRealizado(evento.data_evento) && Number(evento.qtd_inscritos || 0) > 0)
          .sort((a, b) => String(b.data_evento || '').localeCompare(String(a.data_evento || '')))
        setEventos(historico)
      })
      .catch(error => {
        if (!ativo) return
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar eventos do histórico')
      })
      .finally(() => {
        if (ativo) setLoadingEventos(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  const eventosFiltrados = useMemo(() => {
    const termo = normalizeText(filtroEvento)
    return eventos.filter(evento => {
      const combinaModo = modo === 'corporativo'
        ? !empresaEhAomenos1km(evento.empresa_nome)
        : empresaEhAomenos1km(evento.empresa_nome)

      if (!combinaModo) return false
      if (!termo) return true

      const texto = normalizeText(
        `${evento.nome_evento} ${evento.empresa_nome} ${evento.local_nome} ${formatDateBR(evento.data_evento)}`,
      )

      return texto.includes(termo)
    })
  }, [eventos, filtroEvento, modo])

  useEffect(() => {
    if (!eventoSelecionadoId) return
    if (eventosFiltrados.some(evento => evento.id === eventoSelecionadoId)) return

    setEventoSelecionadoId('')
    setListaParticipantes([])
    setBuscaTabela('')
    setOrigemFiltro('todas')
    setSomenteQuentes(false)
    setPaginaAtual(1)
  }, [eventoSelecionadoId, eventosFiltrados])

  useEffect(() => {
    if (!eventoSelecionadoId) return

    let ativo = true
    setLoadingParticipantes(true)
    setBuscaTabela('')
    setOrigemFiltro('todas')
    setSomenteQuentes(false)
    setPaginaAtual(1)

    participantes
      .listarPorContrato(eventoSelecionadoId)
      .then(response => {
        if (!ativo) return
        const lista = ((response.data as Participante[]) ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome))
        setListaParticipantes(lista)
      })
      .catch(error => {
        if (!ativo) return
        setListaParticipantes([])
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar participantes do evento')
      })
      .finally(() => {
        if (ativo) setLoadingParticipantes(false)
      })

    return () => {
      ativo = false
    }
  }, [eventoSelecionadoId])

  const eventoSelecionado = useMemo(
    () => eventos.find(evento => evento.id === eventoSelecionadoId) ?? null,
    [eventos, eventoSelecionadoId],
  )

  const participantesFiltrados = useMemo(() => {
    const termo = normalizeText(buscaTabela)
    return listaParticipantes.filter(participante => {
      const origemParticipante = getOrigemLead(participante.como_conheceu)
      const atendeOrigem = origemFiltro === 'todas' || origemParticipante === origemFiltro
      const atendeQuente = !somenteQuentes || Boolean(participante.interesse_assessoria)
      const atendeBusca = !termo || normalizeText(
        `${participante.nome} ${participante.whatsapp} ${participante.email} ${participante.cidade} ${participante.uf} ${getNivelParticipante(participante)} ${participante.nascimento || ''} ${participante.como_conheceu || ''}`,
      ).includes(termo)

      return atendeOrigem && atendeQuente && atendeBusca
    })
  }, [buscaTabela, listaParticipantes, origemFiltro, somenteQuentes])

  const totalPaginas = Math.max(1, Math.ceil(participantesFiltrados.length / ITENS_POR_PAGINA))

  useEffect(() => {
    setPaginaAtual(prev => Math.min(prev, totalPaginas))
  }, [totalPaginas])

  const participantesPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
    return participantesFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [paginaAtual, participantesFiltrados])

  const resumoOrigem = useMemo(() => {
    const total = listaParticipantes.length
    const origem = {
      instagram: 0,
      indicacao: 0,
      outros: 0,
      assessoria: 0,
    }

    listaParticipantes.forEach(participante => {
      origem[getOrigemLead(participante.como_conheceu)] += 1
      if (participante.interesse_assessoria) origem.assessoria += 1
    })

    const percentual = (valor: number) => (total > 0 ? `${Math.round((valor / total) * 100)}%` : '0%')

    return {
      instagram: percentual(origem.instagram),
      indicacao: percentual(origem.indicacao),
      outros: percentual(origem.outros),
      assessoria: percentual(origem.assessoria),
      interessados: origem.assessoria,
    }
  }, [listaParticipantes])

  const leadsQuentes = useMemo(
    () => listaParticipantes.filter(participante => participante.interesse_assessoria).slice(0, 5),
    [listaParticipantes],
  )

  const infoPaginacao = useMemo(() => {
    if (participantesFiltrados.length === 0) return 'Mostrando 0 de 0'
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA + 1
    const fim = Math.min(paginaAtual * ITENS_POR_PAGINA, participantesFiltrados.length)
    return `Mostrando ${inicio} a ${fim} de ${participantesFiltrados.length}`
  }, [paginaAtual, participantesFiltrados.length])

  function baixarListaCompleta() {
    if (!eventoSelecionado || listaParticipantes.length === 0) {
      toast.info('Selecione um evento com participantes para exportar')
      return
    }

    const nomeEvento = sanitizeFileName(eventoSelecionado.nome_evento || eventoSelecionado.empresa_nome || 'Evento')
    const dataEvento = formatDateBR(eventoSelecionado.data_evento).replaceAll('/', '-')
    const filename = `${nomeEvento} - ${dataEvento} - Base de Leads.xls`

    const rows = listaParticipantes.map(participante => [
      participante.nome || '-',
      participante.whatsapp || '-',
      participante.email || '-',
      getNivelParticipante(participante),
      formatDateBR(participante.nascimento),
      participante.cidade || '-',
      participante.uf || '-',
      participante.como_conheceu || '-',
      participante.interesse_assessoria ? 'Sim' : 'Não',
      participante.formato_interesse || '-',
    ])

    downloadExcelXml(
      filename,
      'Histórico & Leads',
      ['Nome', 'Whatsapp', 'E-mail', 'Nível', 'Nascimento', 'Cidade', 'UF', 'Como Conheceu', 'Interesse Assessoria', 'Formato Interesse'],
      rows,
    )

    toast.success('Download iniciado')
  }

  function baixarListaFiltrada() {
    if (!eventoSelecionado || participantesFiltrados.length === 0) {
      toast.info('Não há participantes filtrados para exportar')
      return
    }

    const nomeEvento = sanitizeFileName(eventoSelecionado.nome_evento || eventoSelecionado.empresa_nome || 'Evento')
    const dataEvento = formatDateBR(eventoSelecionado.data_evento).replaceAll('/', '-')
    const filename = `${nomeEvento} - ${dataEvento} - Leads Filtrados.xls`

    const rows = participantesFiltrados.map(participante => [
      participante.nome || '-',
      participante.whatsapp || '-',
      participante.email || '-',
      getNivelParticipante(participante),
      formatDateBR(participante.nascimento),
      participante.cidade || '-',
      participante.uf || '-',
      participante.como_conheceu || '-',
      participante.interesse_assessoria ? 'Sim' : 'Não',
      participante.formato_interesse || '-',
    ])

    downloadExcelXml(
      filename,
      'Leads Filtrados',
      ['Nome', 'Whatsapp', 'E-mail', 'Nível', 'Nascimento', 'Cidade', 'UF', 'Como Conheceu', 'Interesse Assessoria', 'Formato Interesse'],
      rows,
    )

    toast.success('Download filtrado iniciado')
  }

  function atualizarParticipantes() {
    if (!eventoSelecionadoId) return
    setLoadingParticipantes(true)
    participantes
      .listarPorContrato(eventoSelecionadoId)
      .then(response => {
        const lista = ((response.data as Participante[]) ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome))
        setListaParticipantes(lista)
        toast.success('Lista atualizada')
      })
      .catch(error => {
        toast.error(error instanceof Error ? error.message : 'Erro ao atualizar participantes')
      })
      .finally(() => setLoadingParticipantes(false))
  }

  if (authLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-80" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Histórico & Inteligência</h1>
          <p className="text-sm text-muted-foreground">Consulta de participantes e exportação de leads</p>
        </div>

        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="py-14 text-center">
            <History className="mx-auto mb-4 h-12 w-12 text-zinc-300" />
            <h2 className="text-xl font-bold text-zinc-900">Acesso restrito</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta área contém dados estratégicos visíveis apenas para administradores.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Histórico & Inteligência</h1>
        <p className="text-sm text-muted-foreground">Consulta de participantes e exportação de leads</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setModo('corporativo')}
          className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition ${modo === 'corporativo' ? 'border-[#f25c05] ring-1 ring-[#f25c05]' : 'border-zinc-200 hover:border-zinc-300'}`}
        >
          <div className="flex items-center gap-3">
            <Building2 className={`h-5 w-5 ${modo === 'corporativo' ? 'text-[#f25c05]' : 'text-zinc-500'}`} />
            <span className={`font-bold ${modo === 'corporativo' ? 'text-[#f25c05]' : 'text-zinc-700'}`}>Corporativo (Clientes)</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setModo('proprio')}
          className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition ${modo === 'proprio' ? 'border-[#f25c05] ring-1 ring-[#f25c05]' : 'border-zinc-200 hover:border-zinc-300'}`}
        >
          <div className="flex items-center gap-3">
            <Flag className={`h-5 w-5 ${modo === 'proprio' ? 'text-[#f25c05]' : 'text-zinc-500'}`} />
            <span className={`font-bold ${modo === 'proprio' ? 'text-[#f25c05]' : 'text-zinc-700'}`}>Treinos Próprios (Aomenos1km)</span>
          </div>
        </button>
      </div>

      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="grid gap-4 p-4 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mb-2 block text-sm font-semibold text-zinc-700">Filtrar por Nome/Ano</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                className="pl-9"
                placeholder="Ex: Nubank ou 2025..."
                value={filtroEvento}
                onChange={event => setFiltroEvento(event.target.value)}
              />
            </div>
          </div>
          <div className="md:col-span-8">
            <label className="mb-2 block text-sm font-semibold text-zinc-700">Selecione o Evento Realizado</label>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={eventoSelecionadoId}
              onChange={event => setEventoSelecionadoId(event.target.value)}
              disabled={loadingEventos || eventosFiltrados.length === 0}
            >
              <option value="">{loadingEventos ? 'Carregando eventos...' : 'Selecione um evento...'}</option>
              {eventosFiltrados.map(evento => (
                <option key={evento.id} value={evento.id}>
                  {getEventoLabel(evento)}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {!eventoSelecionado ? (
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="py-20 text-center">
            <History className="mx-auto mb-4 h-14 w-14 text-zinc-300" />
            <p className="text-base text-muted-foreground">Selecione um modo e um evento acima para visualizar os dados.</p>
          </CardContent>
        </Card>
      ) : loadingParticipantes ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="space-y-2 p-5">
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">Evento</p>
                <h2 className="text-2xl font-black text-zinc-900">{eventoSelecionado.nome_evento || eventoSelecionado.empresa_nome}</h2>
                <div className="space-y-1 text-sm text-zinc-600">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>{formatDateBR(eventoSelecionado.data_evento)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{eventoSelecionado.local_nome || 'Local não informado'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-[#f25c05] shadow-sm">
              <CardContent className="flex h-full flex-col items-center justify-center p-5 text-center">
                <Users className="mb-3 h-9 w-9 text-[#f25c05]" />
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">Total Participantes</p>
                <p className="text-4xl font-black text-[#f25c05]">{listaParticipantes.length}</p>
                <p className="mt-2 text-xs text-zinc-500">{resumoOrigem.interessados} com interesse em assessoria</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-400 bg-amber-50/70 shadow-sm">
              <CardContent className="flex h-full flex-col justify-center p-5 text-center">
                <p className="text-lg font-black text-zinc-900">Base de Leads</p>
                <Button type="button" className="mt-4 h-11 w-full bg-amber-500 text-white hover:bg-amber-600" onClick={baixarListaCompleta}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Baixar Lista Completa
                </Button>
                <p className="mt-3 text-xs text-zinc-500">Formato Excel compatível com UTF-8</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-l-4 border-l-pink-500 shadow-sm">
              <CardContent className="p-5 text-center">
                <Camera className="mx-auto mb-2 h-7 w-7 text-pink-500" />
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">Instagram</p>
                <p className="mt-2 text-3xl font-black text-zinc-900">{resumoOrigem.instagram}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500 shadow-sm">
              <CardContent className="p-5 text-center">
                <Users className="mx-auto mb-2 h-7 w-7 text-emerald-600" />
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">Indicação</p>
                <p className="mt-2 text-3xl font-black text-zinc-900">{resumoOrigem.indicacao}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="p-5 text-center">
                <Handshake className="mx-auto mb-2 h-7 w-7 text-blue-500" />
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">Interesse Assessoria</p>
                <p className="mt-2 text-3xl font-black text-zinc-900">{resumoOrigem.assessoria}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-zinc-400 shadow-sm">
              <CardContent className="p-5 text-center">
                <CirclePlus className="mx-auto mb-2 h-7 w-7 text-zinc-500" />
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">Outros</p>
                <p className="mt-2 text-3xl font-black text-zinc-900">{resumoOrigem.outros}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card className="border-zinc-200 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-zinc-900">Refino de Leads</h3>
                    <p className="text-sm text-muted-foreground">Filtre a base para encontrar contatos com maior potencial.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={baixarListaFiltrada} disabled={participantesFiltrados.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Filtrados
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-zinc-700">Origem</label>
                    <select
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      value={origemFiltro}
                      onChange={event => {
                        setOrigemFiltro((event.target.value as OrigemFiltro) || 'todas')
                        setPaginaAtual(1)
                      }}
                    >
                      <option value="todas">Todas</option>
                      <option value="instagram">Instagram</option>
                      <option value="indicacao">Indicação</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSomenteQuentes(prev => !prev)
                        setPaginaAtual(1)
                      }}
                      className={`inline-flex h-10 items-center rounded-lg border px-4 text-sm font-bold transition ${somenteQuentes ? 'border-[#f25c05] bg-orange-50 text-[#f25c05]' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'}`}
                    >
                      Mostrar apenas leads quentes
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div>
                  <h3 className="text-lg font-black text-zinc-900">Leads Quentes</h3>
                  <p className="text-sm text-muted-foreground">Participantes com sinal claro de interesse em assessoria.</p>
                </div>

                {leadsQuentes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum lead quente neste evento.</p>
                ) : (
                  <div className="space-y-3">
                    {leadsQuentes.map(participante => (
                      <button
                        key={participante.id}
                        type="button"
                        onClick={() => {
                          setParticipanteSelecionado(participante)
                          setAbaModal('perfil')
                        }}
                        className="flex w-full items-start justify-between rounded-xl border border-zinc-200 bg-white px-3 py-3 text-left transition hover:border-[#f25c05] hover:bg-orange-50/40"
                      >
                        <div>
                          <p className="font-bold text-zinc-900">{participante.nome}</p>
                          <p className="text-xs text-zinc-500">{participante.formato_interesse || 'Formato não informado'}</p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Quente</span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 shadow-none md:border-zinc-200 md:overflow-hidden md:bg-card md:py-4 md:ring-1 md:ring-foreground/10 md:shadow-sm">
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
                <h3 className="flex items-center gap-2 text-lg font-black text-[#f25c05]">
                  <History className="h-5 w-5" />
                  Lista de Inscritos
                </h3>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button type="button" variant="outline" size="sm" onClick={atualizarParticipantes}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Atualizar
                  </Button>
                  <div className="relative min-w-[240px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      className="pl-9"
                      placeholder="Buscar..."
                      value={buscaTabela}
                      onChange={event => {
                        setBuscaTabela(event.target.value)
                        setPaginaAtual(1)
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="md:overflow-x-auto">
                <RTable>
                  <RTableHeader>
                    <RTableRow>
                      <RTableHead>Nome</RTableHead>
                      <RTableHead>Contato (Whatsapp)</RTableHead>
                      <RTableHead>E-mail</RTableHead>
                      <RTableHead>Nível / Nasc.</RTableHead>
                      <RTableHead>Cidade / UF</RTableHead>
                      <RTableHead mobileLabel="" className="text-right">Ações</RTableHead>
                    </RTableRow>
                  </RTableHeader>
                  <RTableBody>
                    {participantesPaginados.length === 0 ? (
                      <RTableRow>
                        <RTableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          Nenhum participante encontrado.
                        </RTableCell>
                      </RTableRow>
                    ) : (
                      participantesPaginados.map(participante => (
                        <RTableRow key={participante.id}>
                          <RTableCell className="font-bold text-zinc-900">{participante.nome || 'Sem nome'}</RTableCell>
                          <RTableCell>
                            {participante.whatsapp ? (
                              <a
                                href={whatsappLink(participante.whatsapp)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 font-semibold text-emerald-700 transition hover:text-emerald-600"
                                title={`Abrir WhatsApp: ${participante.whatsapp}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#25D366" className="shrink-0">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                <span>{participante.whatsapp}</span>
                              </a>
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </RTableCell>
                          <RTableCell>
                            {participante.email ? (
                              <a
                                href={mailtoLink(participante.email)}
                                className="inline-flex items-center gap-2 text-zinc-600 transition hover:text-zinc-900"
                              >
                                <Mail className="h-4 w-4" />
                                <span>{participante.email}</span>
                              </a>
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </RTableCell>
                          <RTableCell>
                            <div className="space-y-1">
                              <span className="inline-flex rounded-full border border-[#f25c05] bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#f25c05]">
                                {getNivelParticipante(participante)}
                              </span>
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                                <Cake className="h-3.5 w-3.5 text-amber-500" />
                                {formatDateBR(participante.nascimento)}
                              </div>
                            </div>
                          </RTableCell>
                          <RTableCell className="text-zinc-600">
                            {participante.cidade || '-'}{participante.uf ? ` - ${participante.uf}` : ''}
                          </RTableCell>
                          <RTableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              onClick={() => {
                                setParticipanteSelecionado(participante)
                                setAbaModal('dados')
                              }}
                              title="Ver ficha completa"
                              aria-label="Ver ficha completa"
                            >
                              <Eye className="h-4 w-4 text-[#f25c05]" />
                            </Button>
                          </RTableCell>
                        </RTableRow>
                      ))
                    )}
                  </RTableBody>
                </RTable>
              </div>

              <div className="flex flex-col gap-3 border-t bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <small className="text-muted-foreground">{infoPaginacao}</small>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={paginaAtual <= 1}
                    onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Ant
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={paginaAtual >= totalPaginas}
                    onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                  >
                    Próximo
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={Boolean(participanteSelecionado)}
        onOpenChange={open => {
          if (!open) {
            setParticipanteSelecionado(null)
            setAbaModal('dados')
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0" showCloseButton={false}>
          <div className="flex items-center justify-between rounded-t-xl bg-[#f25c05] px-6 py-4 text-white">
            <DialogHeader className="gap-0">
              <DialogTitle className="text-3xl font-black text-white">Ficha Completa do Participante</DialogTitle>
            </DialogHeader>
            <Button type="button" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setParticipanteSelecionado(null)}>
              Fechar
            </Button>
          </div>

          {participanteSelecionado && (
            <div className="space-y-4 bg-zinc-50 px-5 py-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
                <strong>Atenção:</strong> esta ficha consolida os dados preenchidos no check-in e o histórico de marketing do participante.
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={!participanteSelecionado.whatsapp}
                  onClick={() => {
                    const link = whatsappLink(participanteSelecionado.whatsapp)
                    if (!link) return
                    window.open(link, '_blank', 'noopener,noreferrer')
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" className="mr-2 shrink-0">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Abrir WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!participanteSelecionado.email}
                  onClick={() => {
                    const link = mailtoLink(participanteSelecionado.email)
                    if (!link) return
                    window.location.href = link
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar E-mail
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!participanteSelecionado.comprovante_url}
                  onClick={() => {
                    if (!participanteSelecionado.comprovante_url) return
                    window.open(participanteSelecionado.comprovante_url, '_blank', 'noopener,noreferrer')
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Abrir Comprovante
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-orange-200 pb-3">
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${abaModal === 'dados' ? 'bg-[#f25c05] text-white' : 'text-[#f25c05] hover:bg-orange-50'}`}
                  onClick={() => setAbaModal('dados')}
                >
                  Dados Pessoais
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${abaModal === 'treino' ? 'bg-[#f25c05] text-white' : 'text-[#f25c05] hover:bg-orange-50'}`}
                  onClick={() => setAbaModal('treino')}
                >
                  Dados do Treino
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${abaModal === 'perfil' ? 'bg-[#f25c05] text-white' : 'text-[#f25c05] hover:bg-orange-50'}`}
                  onClick={() => setAbaModal('perfil')}
                >
                  Jurídico & Perfil
                </button>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                {abaModal === 'dados' && (
                  <div className="grid gap-4 md:grid-cols-12">
                    <div className="md:col-span-12">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Nome Completo</label>
                      <Input value={participanteSelecionado.nome || ''} readOnly />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">CPF</label>
                      <Input value={participanteSelecionado.cpf || ''} readOnly />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Nascimento</label>
                      <Input value={formatDateBR(participanteSelecionado.nascimento)} readOnly />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Whatsapp</label>
                      <Input value={participanteSelecionado.whatsapp || ''} readOnly />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">E-mail</label>
                      <Input value={participanteSelecionado.email || ''} readOnly />
                    </div>
                    <div className="md:col-span-8">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Cidade</label>
                      <Input value={participanteSelecionado.cidade || ''} readOnly />
                    </div>
                    <div className="md:col-span-4">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">UF</label>
                      <Input value={participanteSelecionado.uf || ''} readOnly />
                    </div>
                  </div>
                )}

                {abaModal === 'treino' && (
                  <div className="grid gap-4 md:grid-cols-12">
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Tamanho Camiseta</label>
                      <Input value={participanteSelecionado.tamanho_camiseta || ''} readOnly />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Nível de Corrida</label>
                      <Input value={getNivelParticipante(participanteSelecionado)} readOnly />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Tempo de Prática</label>
                      <Input value={participanteSelecionado.tempo_pratica || ''} readOnly />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Tem Assessoria?</label>
                      <Input value={participanteSelecionado.tem_assessoria || ''} readOnly />
                    </div>
                    <div className="md:col-span-12">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Objetivo Principal</label>
                      <Input value={participanteSelecionado.objetivo || ''} readOnly />
                    </div>
                    <div className="md:col-span-12">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Observações</label>
                      <textarea
                        className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        value={participanteSelecionado.observacoes || ''}
                        readOnly
                      />
                    </div>
                  </div>
                )}

                {abaModal === 'perfil' && (
                  <div className="space-y-5">
                    <div>
                      <h4 className="mb-3 border-b pb-2 text-sm font-black text-rose-500">Jurídico e Segurança</h4>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Apto Físico</label>
                          <Input value={boolLabel(participanteSelecionado.apto_fisico)} readOnly />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Termo de Responsabilidade</label>
                          <Input value={boolLabel(participanteSelecionado.termo_responsabilidade)} readOnly />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Uso de Imagem</label>
                          <Input value={boolLabel(participanteSelecionado.uso_imagem)} readOnly />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-3 border-b pb-2 text-sm font-black text-emerald-600">Marketing & Leads</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Interesse na Assessoria?</label>
                          <Input value={participanteSelecionado.interesse_assessoria ? 'Sim, quero conhecer!' : 'Não'} readOnly />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Formato de Interesse</label>
                          <Input value={participanteSelecionado.formato_interesse || ''} readOnly />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Como Conheceu</label>
                          <Input value={participanteSelecionado.como_conheceu || ''} readOnly />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Status do Pagamento</label>
                          <Input value={participanteSelecionado.status_pagamento || '-'} readOnly />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Data de Inscrição</label>
                          <Input value={formatDateBR(participanteSelecionado.data_inscricao)} readOnly />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
