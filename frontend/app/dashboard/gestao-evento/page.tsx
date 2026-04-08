'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { contratos, locais, participantes, storage, type Contrato, type Local, type Participante } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { RTable, RTableBody, RTableCell, RTableHead, RTableHeader, RTableRow } from '@/components/ui/responsive-table'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  CalendarDays,
  ClipboardList,
  Copy,
  Download,
  FileText,
  Paperclip,
  MapPin,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Shirt,
  Timer,
  Trash2,
  Save,
  X,
} from 'lucide-react'

type CategoriaEvento = 'TREINOS DA COMUNIDADE' | 'EVENTOS PRÓPRIOS' | 'EVENTOS CORPORATIVOS'

type FormTreino = {
  nome: string
  hora: string
  data: string
  qtd: number
  km: string
  localId: string
}

type FormCheckout = {
  capa_url: string
}

type ParticipanteGestao = Participante & {
  modalidade_distancia?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

function participantesSnapshot(items: ParticipanteGestao[]): string {
  return JSON.stringify(
    items.map(item => [
      item.id,
      item.nome,
      item.status_pagamento,
      item.numero_kit ?? null,
      item.atualizado_em ?? '',
      item.criado_em,
    ]),
  )
}

type ParticipanteTab = 'dados' | 'treino' | 'perfil'

type ParticipanteEdicaoForm = {
  id: string
  nome: string
  cpf: string
  nascimento: string
  whatsapp: string
  email: string
  cidade: string
  uf: string
  tamanho_camiseta: string
  modalidade: string
  modalidade_distancia: string
  tempo_pratica: string
  tem_assessoria: string
  objetivo: string
  apto_fisico: boolean
  termo_responsabilidade: boolean
  uso_imagem: boolean
  interesse_assessoria: boolean
  formato_interesse: string
  como_conheceu: string
  observacoes: string
  status_pagamento: string
  comprovante_url: string
}

function normalizeId(value?: string) {
  return String(value || '').trim()
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function isStatusPago(status?: string) {
  const s = normalizeText(String(status || ''))
  return s.includes('confirmado') || s.includes('confirmed') || s.includes('received')
}

function isTreinoDaComunidade(contrato: Contrato) {
  const empresa = normalizeText(contrato.empresa_nome || '')
  if (!empresa.includes('aomenos1km')) return false

  const id = normalizeText(contrato.id || '')
  const nomeEvento = normalizeText(contrato.nome_evento || '')
  const descricao = normalizeText(contrato.descricao || '')
  const texto = `${nomeEvento} ${descricao}`

  return contrato.valor_total === 0 || id.includes('treino-') || texto.includes('treino') || texto.includes('gratuito')
}

function getCategoriaEvento(contrato: Contrato): CategoriaEvento {
  const empresa = normalizeText(contrato.empresa_nome || '')
  if (!empresa.includes('aomenos1km')) return 'EVENTOS CORPORATIVOS'
  if (isTreinoDaComunidade(contrato)) return 'TREINOS DA COMUNIDADE'
  return 'EVENTOS PRÓPRIOS'
}

function getNomeExibicao(contrato: Contrato) {
  const empresa = contrato.empresa_nome || 'Sem empresa'
  const evento = (contrato.nome_evento || '').trim()
  if (evento && !normalizeText(empresa).includes(normalizeText(evento))) {
    return `${empresa} - ${evento}`
  }
  return empresa
}

function formatDateBR(value?: string) {
  if (!value) return '--/--/----'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '--/--/----'
  return d.toLocaleDateString('pt-BR')
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

function getCheckinLink(id: string) {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/publico/checkin?id=${encodeURIComponent(id)}`
}

function slugifyEvento(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function limparBaseSlug(value: string) {
  return String(value || '')
    .replace(/^\s*(?:\d+[.\-/\s]*){2,}/, '')
    .trim()
}

function getAnoEvento(value?: string) {
  if (!value) return ''
  const raw = String(value).trim()
  if (raw.length >= 4) return raw.slice(0, 4)
  return ''
}

function getCheckinFriendlySlug(evento: Contrato, eventos: Contrato[]) {
  const empresaLimpa = limparBaseSlug(evento.empresa_nome || '')
  const nomeEventoLimpo = limparBaseSlug(evento.nome_evento || '')
  const eventoSlug = slugifyEvento(nomeEventoLimpo)
  const empresaSlug = slugifyEvento(empresaLimpa)
  const anoEvento = getAnoEvento(evento.data_evento)

  if (!eventoSlug) {
    return slugifyEvento(`${evento.empresa_nome || ''} ${evento.nome_evento || ''}`)
  }

  const mesmosNomes = eventos.filter(item => slugifyEvento(limparBaseSlug(item.nome_evento || '')) === eventoSlug)
  if (mesmosNomes.length <= 1) {
    return eventoSlug
  }

  const mesmoNomeMesmaEmpresa = mesmosNomes.filter(item => slugifyEvento(limparBaseSlug(item.empresa_nome || '')) === empresaSlug)
  if (empresaSlug && mesmoNomeMesmaEmpresa.length <= 1) {
    return `${eventoSlug}-${empresaSlug}`
  }

  if (anoEvento) {
    return `${eventoSlug}-${anoEvento}`
  }

  if (empresaSlug && anoEvento) {
    return `${eventoSlug}-${empresaSlug}-${anoEvento}`
  }

  return eventoSlug
}

function getCheckinFriendlyLink(evento: Contrato, eventos: Contrato[]) {
  if (typeof window === 'undefined') return ''
  const slug = getCheckinFriendlySlug(evento, eventos)
  if (!slug) {
    return getCheckinLink(evento.id)
  }
  return `${window.location.origin}/${slug}`
}

function normalizeDateInput(value?: string) {
  if (!value) return ''
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function boolToLabel(value?: boolean) {
  return value ? 'Sim' : 'Não'
}

function formatPhoneBR(value: string) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''

  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function pagamentoConfirmado(status?: string) {
  const normalizado = normalizeText(String(status || ''))
  return normalizado.includes('confirmado') || normalizado.includes('confirmed') || normalizado.includes('recebido')
}

function eventoComPagamentoParticipante(contrato?: Contrato | null) {
  if (!contrato) return false
  const empresa = normalizeText(contrato.empresa_nome || '')
  return empresa.includes('aomenos1km')
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
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function whatsappLink(numero: string): string {
  const digits = numero.replace(/\D/g, '')
  const withCC = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
  return `https://wa.me/${withCC}`
}

function getParticipanteForm(participante: ParticipanteGestao): ParticipanteEdicaoForm {
  const modalidade = participante.modalidade_distancia || participante.modalidade || ''

  return {
    id: participante.id,
    nome: participante.nome || '',
    cpf: participante.cpf || '',
    nascimento: normalizeDateInput(participante.nascimento),
    whatsapp: participante.whatsapp || '',
    email: participante.email || '',
    cidade: participante.cidade || '',
    uf: participante.uf || '',
    tamanho_camiseta: participante.tamanho_camiseta || '',
    modalidade,
    modalidade_distancia: modalidade,
    tempo_pratica: participante.tempo_pratica || '',
    tem_assessoria: participante.tem_assessoria || '',
    objetivo: participante.objetivo || '',
    apto_fisico: Boolean(participante.apto_fisico),
    termo_responsabilidade: Boolean(participante.termo_responsabilidade),
    uso_imagem: Boolean(participante.uso_imagem),
    interesse_assessoria: Boolean(participante.interesse_assessoria),
    formato_interesse: participante.formato_interesse || '',
    como_conheceu: participante.como_conheceu || '',
    observacoes: participante.observacoes || '',
    status_pagamento: participante.status_pagamento || '',
    comprovante_url: participante.comprovante_url || '',
  }
}

export default function GestaoEventoPage() {
  const searchParams = useSearchParams()
  const eventoInicial = normalizeId(searchParams.get('evento') || '')
  const { user } = useAuth()
  const isConsultor = user?.perfil === 'Consultor'
  const [loadingEventos, setLoadingEventos] = useState(true)
  const [eventosConfirmados, setEventosConfirmados] = useState<Contrato[]>([])
  const [eventoId, setEventoId] = useState('')

  const [locaisCadastrados, setLocaisCadastrados] = useState<Local[]>([])
  const [loadingLocais, setLoadingLocais] = useState(false)
  const [buscaLocal, setBuscaLocal] = useState('')

  const [modalTreinoOpen, setModalTreinoOpen] = useState(false)
  const [modalLocalOpen, setModalLocalOpen] = useState(false)
  const [salvandoTreino, setSalvandoTreino] = useState(false)
  const [loadingParticipantes, setLoadingParticipantes] = useState(false)
  const [salvandoCheckout, setSalvandoCheckout] = useState(false)
  const [uploadingCapa, setUploadingCapa] = useState(false)
  const [nomeArquivoCapa, setNomeArquivoCapa] = useState('Nenhum arquivo selecionado')
  const [buscaParticipante, setBuscaParticipante] = useState('')
  const [linhasParticipantes, setLinhasParticipantes] = useState<ParticipanteGestao[]>([])
  const [participanteEmEdicao, setParticipanteEmEdicao] = useState<ParticipanteGestao | null>(null)
  const [abaParticipante, setAbaParticipante] = useState<ParticipanteTab>('dados')
  const [salvandoParticipante, setSalvandoParticipante] = useState(false)
  const [formParticipante, setFormParticipante] = useState<ParticipanteEdicaoForm | null>(null)
  const [participanteParaExcluir, setParticipanteParaExcluir] = useState<ParticipanteGestao | null>(null)
  const [excluindoParticipante, setExcluindoParticipante] = useState(false)
  const [relatorioCamisetasOpen, setRelatorioCamisetasOpen] = useState(false)

  const [formCheckout, setFormCheckout] = useState<FormCheckout>({
    capa_url: '',
  })

  const [formTreino, setFormTreino] = useState<FormTreino>({
    nome: '',
    hora: '07:00',
    data: '',
    qtd: 50,
    km: '',
    localId: '',
  })

  const eventosAgrupados = useMemo(() => {
    const grupos: Record<CategoriaEvento, Contrato[]> = {
      'TREINOS DA COMUNIDADE': [],
      'EVENTOS PRÓPRIOS': [],
      'EVENTOS CORPORATIVOS': [],
    }

    eventosConfirmados.forEach(evt => {
      grupos[getCategoriaEvento(evt)].push(evt)
    })

    const sortFn = (a: Contrato, b: Contrato) => {
      const da = a.data_evento ? new Date(a.data_evento).getTime() : Number.MAX_SAFE_INTEGER
      const db = b.data_evento ? new Date(b.data_evento).getTime() : Number.MAX_SAFE_INTEGER
      return da - db
    }

    grupos['TREINOS DA COMUNIDADE'].sort(sortFn)
    grupos['EVENTOS PRÓPRIOS'].sort(sortFn)
    grupos['EVENTOS CORPORATIVOS'].sort(sortFn)

    return grupos
  }, [eventosConfirmados])

  const eventoSelecionado = useMemo(
    () => eventosConfirmados.find(evt => normalizeId(evt.id) === normalizeId(eventoId)) || null,
    [eventosConfirmados, eventoId],
  )

  const consultorResponsavelEvento = useMemo(() => {
    if (!isConsultor || !eventoSelecionado) return false
    return normalizeText(eventoSelecionado.consultor || '') === normalizeText(user?.nome || '')
  }, [isConsultor, eventoSelecionado, user?.nome])

  const canManageEventoSelecionado = !isConsultor || consultorResponsavelEvento

  const eventoIdRef = useRef<string>('')
  useEffect(() => {
    eventoIdRef.current = eventoSelecionado?.id ?? ''
  }, [eventoSelecionado])

  useEffect(() => {
    const bump = () => { if (eventoIdRef.current) void carregarParticipantesEvento(eventoIdRef.current, { silent: true }) }
    const onVisible = () => { if (!document.hidden) bump() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('aomenos-refresh', bump)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('aomenos-refresh', bump)
    }
  }, [])

  const localSelecionado = useMemo(
    () => locaisCadastrados.find(l => l.id === formTreino.localId) || null,
    [locaisCadastrados, formTreino.localId],
  )

  const locaisFiltrados = useMemo(() => {
    const termo = normalizeText(buscaLocal.trim())
    if (!termo) return locaisCadastrados
    return locaisCadastrados.filter(l => normalizeText(`${l.nome} ${l.cidade} ${l.uf}`).includes(termo))
  }, [buscaLocal, locaisCadastrados])

  const participantesFiltrados = useMemo(() => {
    const termo = normalizeText(buscaParticipante.trim())
    if (!termo) return linhasParticipantes
    if (!canManageEventoSelecionado) {
      return linhasParticipantes.filter(p =>
        normalizeText(`${p.nome} ${p.tamanho_camiseta} ${p.modalidade}`).includes(termo),
      )
    }
    return linhasParticipantes.filter(p =>
      normalizeText(`${p.nome} ${p.whatsapp} ${p.tamanho_camiseta} ${p.modalidade}`).includes(termo),
    )
  }, [buscaParticipante, linhasParticipantes, canManageEventoSelecionado])

  const textoEventoSelecionado = eventoSelecionado
    ? `${getNomeExibicao(eventoSelecionado)} (${formatDateBR(eventoSelecionado.data_evento)})`
    : ''

  useEffect(() => {
    carregarEventosConfirmados(eventoInicial || undefined)
  }, [eventoInicial])

  useEffect(() => {
    if (!eventoSelecionado) {
      setLinhasParticipantes([])
      setFormCheckout({
        capa_url: '',
      })
      return
    }

    setFormCheckout({
      capa_url: eventoSelecionado.capa_url || '',
    })

    void carregarParticipantesEvento(eventoSelecionado.id)
  }, [eventoSelecionado])

  useEffect(() => {
    if (!eventoSelecionado?.id) return

    const token = sessionStorage.getItem('token')
    if (!token) return

    let ativo = true
    const controller = new AbortController()
    let reconnectTimer: number | null = null

    const conectar = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/contratos/${eventoSelecionado.id}/participantes/stream`, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!resp.ok || !resp.body) {
          throw new Error('Falha ao abrir stream de participantes')
        }

        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (ativo) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split('\n\n')
          buffer = chunks.pop() ?? ''

          for (const rawChunk of chunks) {
            const lines = rawChunk
              .split('\n')
              .map(line => line.trim())
              .filter(Boolean)

            if (lines.length === 0) continue

            let eventName = 'message'
            for (const line of lines) {
              if (line.startsWith(':')) continue
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim()
              }
            }

            if (eventName !== 'participantes_atualizados') continue
            void carregarParticipantesEvento(eventoSelecionado.id, { silent: true })
          }
        }
      } catch {
        if (!ativo || controller.signal.aborted) return
      }

      if (ativo) {
        reconnectTimer = window.setTimeout(() => {
          void conectar()
        }, 2000)
      }
    }

    void conectar()

    return () => {
      ativo = false
      controller.abort()
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
    }
  }, [eventoSelecionado?.id])

  async function carregarEventosConfirmados(nextSelecionado?: string) {
    setLoadingEventos(true)
    try {
      const r = await contratos.listar({ status: 'Confirmado', allowGlobal: isConsultor })
      const lista = (r.data || []).filter(evt => !isPastEvent(evt.data_evento))
      setEventosConfirmados(lista)

      const alvo = normalizeId(nextSelecionado)
      const atual = normalizeId(eventoId)

      if (alvo && lista.some(evt => normalizeId(evt.id) === alvo)) {
        setEventoId(alvo)
      } else if (atual && lista.some(evt => normalizeId(evt.id) === atual)) {
        setEventoId(atual)
      } else {
        setEventoId('')
      }
    } catch {
      toast.error('Erro ao carregar eventos confirmados')
    } finally {
      setLoadingEventos(false)
    }
  }

  async function abrirModalTreino() {
    setFormTreino({
      nome: '',
      hora: '07:00',
      data: '',
      qtd: 50,
      km: '',
      localId: '',
    })
    setBuscaLocal('')
    setModalTreinoOpen(true)

    setLoadingLocais(true)
    try {
      const r = await locais.listar()
      const ativos = (r.data || []).filter(l => l.ativo)
      setLocaisCadastrados(ativos)
    } catch {
      toast.error('Não foi possível carregar os locais cadastrados')
    } finally {
      setLoadingLocais(false)
    }
  }

  async function criarTreino() {
    if (!formTreino.nome.trim()) {
      toast.error('Informe o nome do treino')
      return
    }
    if (!formTreino.data) {
      toast.error('Informe a data do treino')
      return
    }
    if (!formTreino.localId || !localSelecionado) {
      toast.error('Selecione um local cadastrado')
      return
    }

    const hoje = new Date().toISOString().split('T')[0]
    if (formTreino.data < hoje) {
      toast.error('Data no passado não permitida')
      return
    }

    setSalvandoTreino(true)
    try {
      const resp = (await contratos.criar({
        empresa_nome: 'Aomenos1km',
        descricao: `${formTreino.nome} (${formTreino.hora})`,
        valor_total: 0,
        data_evento: formTreino.data,
        local_nome: localSelecionado.nome,
        modalidade: 'Treino',
        qtd_contratada: Number(formTreino.qtd || 0),
        qtd_kit: 0,
        km: formTreino.km || '0',
        status: 'Confirmado',
        valor_pago: 0,
        consultor: user?.nome || 'Admin',
        possui_kit: false,
        tipo_kit: 'Treino Livre',
        nome_evento: formTreino.nome.trim(),
        observacoes: `Evento próprio criado via Gestão do Evento. Horário: ${formTreino.hora}`,
      })) as { data?: { id?: string } }

      toast.success('Treino criado com sucesso')
      setModalTreinoOpen(false)
      await carregarEventosConfirmados(normalizeId(resp?.data?.id))
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao criar treino')
    } finally {
      setSalvandoTreino(false)
    }
  }

  async function carregarParticipantesEvento(contratoId: string, options?: { silent?: boolean }) {
    if (!options?.silent) setLoadingParticipantes(true)
    try {
      const r = await participantes.listarPorContrato(contratoId)
      const proximos = (r.data || []) as ParticipanteGestao[]
      setLinhasParticipantes(prev => {
        if (options?.silent && participantesSnapshot(prev) === participantesSnapshot(proximos)) {
          return prev
        }
        return proximos
      })
    } catch {
      if (!options?.silent) {
        setLinhasParticipantes([])
      }
      if (!options?.silent) toast.error('Erro ao carregar participantes do evento')
    } finally {
      if (!options?.silent) setLoadingParticipantes(false)
    }
  }

  function abrirEdicaoParticipante(participante: ParticipanteGestao) {
    setParticipanteEmEdicao(participante)
    setFormParticipante(getParticipanteForm(participante))
    setAbaParticipante('dados')
  }

  async function salvarParticipante() {
    if (!formParticipante || !eventoSelecionado) return

    setSalvandoParticipante(true)
    try {
      await participantes.editar(formParticipante.id, {
        nome: formParticipante.nome,
        cpf: formParticipante.cpf,
        nascimento: formParticipante.nascimento,
        whatsapp: formParticipante.whatsapp,
        email: formParticipante.email,
        cidade: formParticipante.cidade,
        uf: formParticipante.uf,
        tamanho_camiseta: formParticipante.tamanho_camiseta,
        modalidade: formParticipante.modalidade,
        modalidade_distancia: formParticipante.modalidade_distancia || formParticipante.modalidade,
        tempo_pratica: formParticipante.tempo_pratica,
        tem_assessoria: formParticipante.tem_assessoria,
        objetivo: formParticipante.objetivo,
        apto_fisico: formParticipante.apto_fisico,
        termo_responsabilidade: formParticipante.termo_responsabilidade,
        uso_imagem: formParticipante.uso_imagem,
        interesse_assessoria: formParticipante.interesse_assessoria,
        formato_interesse: formParticipante.formato_interesse,
        como_conheceu: formParticipante.como_conheceu,
        observacoes: formParticipante.observacoes,
        status_pagamento: formParticipante.status_pagamento,
        comprovante_url: formParticipante.comprovante_url,
      })

      toast.success('Participante atualizado com sucesso')
      setParticipanteEmEdicao(null)
      setFormParticipante(null)
      await carregarParticipantesEvento(eventoSelecionado.id)
      await carregarEventosConfirmados(eventoSelecionado.id)
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao atualizar participante')
    } finally {
      setSalvandoParticipante(false)
    }
  }

  async function confirmarExclusaoParticipante() {
    if (!participanteParaExcluir || !eventoSelecionado) return

    setExcluindoParticipante(true)
    try {
      await participantes.deletar(participanteParaExcluir.id)
      setLinhasParticipantes(prev => prev.filter(item => item.id !== participanteParaExcluir.id))
      toast.success('Participante removido com sucesso')
      setParticipanteParaExcluir(null)
      await carregarEventosConfirmados(eventoSelecionado.id)
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao excluir participante')
    } finally {
      setExcluindoParticipante(false)
    }
  }

  async function salvarCheckout() {
    if (!eventoSelecionado) return
    if (!canManageEventoSelecionado) {
      toast.error('Apenas o Consultor Responsável pode alterar a capa do evento')
      return
    }

    setSalvandoCheckout(true)
    try {
      await contratos.atualizar(eventoSelecionado.id, {
        ...eventoSelecionado,
        capa_url: formCheckout.capa_url,
      })
      toast.success('Configurações salvas com sucesso')
      await carregarEventosConfirmados(eventoSelecionado.id)
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao salvar configurações')
    } finally {
      setSalvandoCheckout(false)
    }
  }

  function abrirRelatorioCamisetas() {
    if (!eventoSelecionado) return
    if (linhasParticipantes.length === 0) {
      toast.info('Ainda não há participantes para gerar o relatório')
      return
    }
    setRelatorioCamisetasOpen(true)
  }

  function baixarListaParticipantesExcel() {
    if (!eventoSelecionado) return
    if (!canManageEventoSelecionado) {
      toast.error('Apenas o Consultor Responsável pode baixar a lista de participantes')
      return
    }
    if (linhasParticipantes.length === 0) {
      toast.info('Ainda não há participantes para gerar a lista')
      return
    }

    const rowsXml = linhasParticipantes.map(p => {
      const values = [
        p.nome || '',
        p.whatsapp || p.email || '',
        p.status_pagamento || '',
        p.tamanho_camiseta || '',
        p.modalidade_distancia || p.modalidade || '',
      ]
      return `<Row>${values.map(v => `<Cell><Data ss:Type="String">${escapeXml(v)}</Data></Cell>`).join('')}</Row>`
    }).join('')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Worksheet ss:Name="Relatório de Camisetas">
    <Table>
      <Row>
        <Cell><Data ss:Type="String">Nome</Data></Cell>
        <Cell><Data ss:Type="String">Contato</Data></Cell>
        <Cell><Data ss:Type="String">Pagamento</Data></Cell>
        <Cell><Data ss:Type="String">Camiseta</Data></Cell>
        <Cell><Data ss:Type="String">Nível</Data></Cell>
      </Row>
      ${rowsXml}
    </Table>
  </Worksheet>
</Workbook>`

    const dateRaw = eventoSelecionado.data_evento ? formatDateBR(eventoSelecionado.data_evento) : formatDateBR(new Date().toISOString())
    const dateForFile = dateRaw.replaceAll('/', '-')
    const nomeEvento = sanitizeFileName(getNomeExibicao(eventoSelecionado))
    const fileName = sanitizeFileName(`${nomeEvento} - ${dateForFile} - Lista de Participantes.xls`)

    const blob = new Blob(['\uFEFF' + xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const resumoCamisetas = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of linhasParticipantes) {
      const tamanho = String(p.tamanho_camiseta || '').trim().toUpperCase()
      if (!tamanho) continue
      counts.set(tamanho, (counts.get(tamanho) || 0) + 1)
    }

    const ordemPadrao = ['P', 'M', 'G', 'GG', 'XG', 'ÚNICO']
    const ordenadas: Array<{ tamanho: string; qtd: number }> = []

    for (const t of ordemPadrao) {
      const qtd = counts.get(t)
      if (qtd) {
        ordenadas.push({ tamanho: t, qtd })
        counts.delete(t)
      }
    }

    Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .forEach(([tamanho, qtd]) => ordenadas.push({ tamanho, qtd }))

    return ordenadas
  }, [linhasParticipantes])

  const totalCamisetasResumo = useMemo(
    () => resumoCamisetas.reduce((acc, item) => acc + item.qtd, 0),
    [resumoCamisetas],
  )

  async function copiarLinkCheckin() {
    if (!eventoSelecionado) return
    if (!canManageEventoSelecionado) {
      toast.error('Link Restrito ao Consultor Responsável')
      return
    }
    try {
      await navigator.clipboard.writeText(getCheckinFriendlyLink(eventoSelecionado, eventosConfirmados))
      toast.success('Link de check-in copiado')
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }

  async function uploadImagem(file: File) {
    const assinatura = await storage.gerarAssinatura()
    const sig = assinatura.data

    const formData = new FormData()
    formData.append('file', file)
    formData.append('api_key', sig.api_key)
    formData.append('timestamp', String(sig.timestamp))
    formData.append('signature', sig.signature)
    formData.append('folder', sig.folder)
    if (sig.upload_preset) {
      formData.append('upload_preset', sig.upload_preset)
    }

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, {
      method: 'POST',
      body: formData,
    })

    const body = (await uploadRes.json()) as { secure_url?: string; error?: { message?: string } }
    if (!uploadRes.ok || !body?.secure_url) {
      throw new Error(body?.error?.message || 'Falha ao enviar imagem')
    }

    return body.secure_url
  }

  async function handleUploadCapa(file?: File) {
    if (!file) return
    if (!canManageEventoSelecionado) {
      toast.error('Apenas o Consultor Responsável pode alterar a capa do evento')
      return
    }
    setUploadingCapa(true)
    try {
      const url = await uploadImagem(file)
      setFormCheckout(p => ({ ...p, capa_url: url }))
      toast.success('Capa enviada com sucesso')
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao enviar capa')
    } finally {
      setUploadingCapa(false)
    }
  }

  const inscritosAtuais = eventoSelecionado
    ? loadingParticipantes
      ? (eventoSelecionado.qtd_inscritos || 0)
      : linhasParticipantes.length
    : 0

  const percentual = eventoSelecionado
    ? Math.min(100, Math.round((inscritosAtuais / Math.max(1, eventoSelecionado.qtd_contratada || 0)) * 100))
    : 0

  const pagosAtuais = useMemo(() => linhasParticipantes.filter(p => isStatusPago(p.status_pagamento)).length, [linhasParticipantes])
  const pendentesAtuais = useMemo(() => Math.max(0, inscritosAtuais - pagosAtuais), [inscritosAtuais, pagosAtuais])
  const limitePendentesAlerta = 10
  const pendentesEmAlerta = pendentesAtuais >= limitePendentesAlerta

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Gestão do Evento</h1>
      </div>

      <Card>
        <CardContent className="p-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-amber-400 text-amber-950">
              <ClipboardList className="h-4 w-4" />
            </span>

            {loadingEventos ? (
              <div className="h-8 flex-1 rounded bg-muted animate-pulse" />
            ) : (
              <Select value={eventoId} onValueChange={v => setEventoId(normalizeId(v || ''))}>
                <SelectTrigger className="h-10 w-full min-w-0">
                  <span className={textoEventoSelecionado ? 'text-foreground truncate' : 'text-muted-foreground truncate'}>
                    {textoEventoSelecionado || 'Selecione um evento...'}
                  </span>
                </SelectTrigger>
                <SelectContent className="min-w-[320px] sm:min-w-[720px]" align="start">
                  {eventosConfirmados.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Nenhum evento confirmado encontrado
                    </SelectItem>
                  ) : (
                    <>
                      {(Object.keys(eventosAgrupados) as CategoriaEvento[]).map(grupo => {
                        const itens = eventosAgrupados[grupo]
                        if (itens.length === 0) return null
                        return (
                          <SelectGroup key={grupo}>
                            <SelectLabel className="font-bold text-foreground">{grupo}</SelectLabel>
                            {itens.map(evt => (
                              <SelectItem key={evt.id} value={normalizeId(evt.id)}>
                                {getNomeExibicao(evt)} ({formatDateBR(evt.data_evento)})
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )
                      })}
                    </>
                  )}
                </SelectContent>
              </Select>
            )}

            <Button type="button" variant="outline" className="text-[#f25c05] border-[#f25c05]" onClick={abrirModalTreino}>
              <PlusCircle className="h-4 w-4 mr-1" /> Novo Treino
            </Button>
          </div>
        </CardContent>
      </Card>

      {!eventoSelecionado ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="h-14 w-14 mx-auto mb-4 opacity-50" />
          <h3 className="text-4xl font-semibold text-foreground/80">Nenhum evento selecionado</h3>
          <p className="mt-2 text-xl">Escolha uma empresa na lista acima para gerenciar inscritos, kits e links.</p>
        </div>
      ) : (
        <>
          {!canManageEventoSelecionado && (
            <Card className="border-l-4 border-l-amber-500 bg-amber-50/60">
              <CardContent className="py-3 text-sm text-amber-900">
                Você está visualizando um evento de outro responsável. Algumas ações ficam bloqueadas para proteger os dados.
              </CardContent>
            </Card>
          )}

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Evento Selecionado</p>
              <h2 className="text-4xl font-bold">{getNomeExibicao(eventoSelecionado)}</h2>
              <div className="mt-2 text-muted-foreground flex flex-wrap items-center gap-2">
                <CalendarDays className="h-4 w-4 text-[#f25c05]" /> {formatDateBR(eventoSelecionado.data_evento)}
                <span>|</span>
                <MapPin className="h-4 w-4 text-rose-500" /> {eventoSelecionado.local_nome || 'Local não definido'}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase">Link de Check-in (Participantes)</p>
                <div className="rounded border bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
                  {!canManageEventoSelecionado ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z"/>
                      </svg>
                      Link Restrito ao Consultor Responsável
                    </span>
                  ) : (
                    <a
                      href={getCheckinFriendlyLink(eventoSelecionado, eventosConfirmados)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm truncate text-blue-600 hover:underline"
                    >
                      {getCheckinFriendlyLink(eventoSelecionado, eventosConfirmados)}
                    </a>
                  )}
                  <button type="button" className="text-[#f25c05] disabled:opacity-50" onClick={copiarLinkCheckin} disabled={!canManageEventoSelecionado}>
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-600">
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase">Status das Vagas</p>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-extrabold text-emerald-700">
                    {inscritosAtuais} / {eventoSelecionado.qtd_contratada || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">{percentual}%</p>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600" style={{ width: `${percentual}%` }} />
                </div>
                {!loadingParticipantes && (
                  <p className="text-xs text-muted-foreground">
                    Pagos: <span className="font-semibold text-emerald-700">{pagosAtuais}</span>
                    {' '}• Pendentes:{' '}
                    <span className={pendentesEmAlerta ? 'font-bold text-rose-600' : 'font-semibold text-amber-700'}>
                      {pendentesAtuais}
                    </span>
                    {pendentesEmAlerta && (
                      <span className="ml-1 font-semibold text-rose-600">alto</span>
                    )}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase">Ação Rápida</p>
                <Button type="button" className="w-full bg-amber-400 text-amber-950 hover:bg-amber-500" onClick={abrirRelatorioCamisetas}>
                  <Shirt className="h-4 w-4 mr-1" /> Relatório de Camisetas
                </Button>
                <Button
                  type="button"
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={baixarListaParticipantesExcel}
                  disabled={!canManageEventoSelecionado}
                >
                  <Download className="h-4 w-4 mr-1" /> Baixar Lista
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-4 space-y-4">
              <h3 className="font-extrabold text-2xl">Arte de Capa do Evento</h3>

              <div className="space-y-1">
                <label className="text-sm font-semibold">URL da imagem de capa</label>
                <Input
                  placeholder="https://..."
                  value={formCheckout.capa_url}
                  onChange={e => setFormCheckout(p => ({ ...p, capa_url: e.target.value }))}
                  disabled={!canManageEventoSelecionado || uploadingCapa || salvandoCheckout}
                />
                <input
                  id="capa-evento-file"
                  type="file"
                  accept="image/*"
                  disabled={!canManageEventoSelecionado || uploadingCapa || salvandoCheckout}
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    setNomeArquivoCapa(file?.name || 'Nenhum arquivo selecionado')
                    void handleUploadCapa(file)
                  }}
                />
                <label
                  htmlFor="capa-evento-file"
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${canManageEventoSelecionado ? 'cursor-pointer border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200' : 'cursor-not-allowed border-zinc-200 bg-zinc-100/70 text-zinc-400'}`}
                  aria-disabled={!canManageEventoSelecionado}
                >
                  <span className={`inline-flex items-center gap-2 font-semibold ${canManageEventoSelecionado ? 'text-zinc-700' : 'text-zinc-400'}`}>
                    <Paperclip className={`h-4 w-4 ${canManageEventoSelecionado ? 'text-zinc-500' : 'text-zinc-400'}`} />
                    Anexar arte de capa
                  </span>
                  <span className="truncate text-xs text-zinc-500">{nomeArquivoCapa}</span>
                </label>
                {uploadingCapa ? <p className="text-xs text-muted-foreground">Enviando capa...</p> : null}
                {formCheckout.capa_url ? (
                  <div className="mt-2 rounded border bg-muted/20 p-3">
                    <img src={formCheckout.capa_url} alt="Prévia da capa" className="max-h-44 w-full object-contain rounded" />
                  </div>
                ) : (
                  <div className="mt-2 rounded border bg-muted/20 p-3 space-y-2">
                    <p className="text-xs text-muted-foreground text-center">Nenhuma arte enviada — será usada a imagem padrão:</p>
                    <img src="/arte-aomenos1km-corridas-padrao.jpeg" alt="Capa padrão AoMenos1km" className="max-h-44 w-full object-contain rounded" />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={salvarCheckout} disabled={!canManageEventoSelecionado || salvandoCheckout || uploadingCapa} className="bg-amber-400 text-amber-950 hover:bg-amber-500">
                  <Save className="h-4 w-4 mr-1" /> {salvandoCheckout ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 shadow-none md:gap-4 md:overflow-hidden md:bg-card md:py-4 md:ring-1 md:shadow-sm">
            <CardContent className="pt-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <h3 className="font-extrabold text-2xl">Lista de Participantes</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8 w-72"
                      placeholder={!canManageEventoSelecionado ? 'Nome, tamanho...' : 'Nome, telefone, tamanho...'}
                      value={buscaParticipante}
                      onChange={e => setBuscaParticipante(e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={() => eventoSelecionado && carregarParticipantesEvento(eventoSelecionado.id)}>
                    <RefreshCw className={`h-4 w-4 ${loadingParticipantes ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {!canManageEventoSelecionado && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span className="inline-flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z"/>
                    </svg>
                    Você está visualizando um evento de outro responsável. Para proteger os dados, contatos e ações desta lista ficam bloqueados.
                  </span>
                </div>
              )}

              {loadingParticipantes ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Carregando participantes...</p>
              ) : participantesFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum participante encontrado.</p>
              ) : (
                <RTable className="md:overflow-hidden md:rounded-lg md:border">
                  <RTableHeader>
                    <RTableRow>
                      <RTableHead>Nome</RTableHead>
                      <RTableHead>Contato</RTableHead>
                      <RTableHead>Pgto</RTableHead>
                      <RTableHead>Camiseta</RTableHead>
                      <RTableHead>Nível do Part.</RTableHead>
                      <RTableHead mobileLabel="" className="text-right">Ações</RTableHead>
                    </RTableRow>
                  </RTableHeader>
                  <RTableBody>
                    {participantesFiltrados.map(p => (
                      <RTableRow key={p.id}>
                        <RTableCell className="font-semibold">{p.nome || 'Sem nome'}</RTableCell>
                        <RTableCell>
                          {canManageEventoSelecionado ? (
                            p.whatsapp ? (
                              <a
                                href={whatsappLink(p.whatsapp)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-zinc-700 transition-colors hover:text-emerald-600 cursor-pointer"
                                title={`Abrir WhatsApp: ${p.whatsapp}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#25D366" className="shrink-0">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                {p.whatsapp}
                              </a>
                            ) : p.email || '-'
                          ) : (
                            <span className="inline-flex items-center text-zinc-500" title="Privado">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                                <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z"/>
                              </svg>
                            </span>
                          )}
                        </RTableCell>
                        <RTableCell>
                          {(() => {
                            const confirmado = pagamentoConfirmado(p.status_pagamento)
                            const linkPgtoOuComprovante = String(p.comprovante_url || '').trim()
                            const eventoTemPagamento = eventoComPagamentoParticipante(eventoSelecionado)
                            const podeAbrirLink = Boolean(linkPgtoOuComprovante) && eventoTemPagamento
                            const tooltip = podeAbrirLink
                              ? (confirmado ? 'Abrir comprovante de pagamento' : 'Abrir página de pagamento do participante')
                              : eventoTemPagamento
                                ? (confirmado ? 'Pagamento confirmado (comprovante indisponível)' : 'Pagamento pendente (link indisponível)')
                                : 'Evento sem cobrança de inscrição'

                            return (
                              <button
                                type="button"
                                disabled={!podeAbrirLink || isConsultor}
                                title={tooltip}
                                aria-label={tooltip}
                                onClick={() => {
                                  if (!podeAbrirLink || isConsultor) return
                                  window.open(linkPgtoOuComprovante, '_blank', 'noopener,noreferrer')
                                }}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white ${confirmado ? 'bg-emerald-600' : 'bg-rose-500'} ${podeAbrirLink && !isConsultor ? 'cursor-pointer hover:brightness-95' : 'cursor-default opacity-95'}`}
                              >
                                {confirmado ? '✓' : '×'}
                              </button>
                            )
                          })()}
                        </RTableCell>
                        <RTableCell>
                          <span className="inline-flex rounded-full border border-orange-500 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-orange-600">
                            {p.tamanho_camiseta || '-'}
                          </span>
                        </RTableCell>
                        <RTableCell>
                          <span className="inline-flex rounded-full border border-orange-500 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-orange-600">
                            {p.modalidade_distancia || p.modalidade || '-'}
                          </span>
                        </RTableCell>
                        <RTableCell className="text-right">
                          {canManageEventoSelecionado ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                                onClick={() => abrirEdicaoParticipante(p)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setParticipanteParaExcluir(p)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center text-zinc-500" title="Ações protegidas">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                                <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z"/>
                              </svg>
                            </span>
                          )}
                        </RTableCell>
                      </RTableRow>
                    ))}
                  </RTableBody>
                </RTable>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={relatorioCamisetasOpen} onOpenChange={setRelatorioCamisetasOpen}>
        <DialogContent className="max-w-md border-0 p-0">
          <div className="rounded-xl bg-white p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-2 text-4xl font-extrabold text-zinc-700">
                <Shirt className="h-7 w-7 text-[#f25c05]" />
                Relatório de Camisetas
              </DialogTitle>
            </DialogHeader>

            {resumoCamisetas.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem camisetas registradas para este evento.</p>
            ) : (
              <div className="md:overflow-hidden md:rounded-lg md:border">
                <RTable>
                  <RTableHeader>
                    <RTableRow>
                      <RTableHead className="text-2xl font-black text-zinc-700">Tamanho</RTableHead>
                      <RTableHead className="text-center text-2xl font-black text-zinc-700">Quantidade</RTableHead>
                    </RTableRow>
                  </RTableHeader>
                  <RTableBody>
                    {resumoCamisetas.map(item => (
                      <RTableRow key={item.tamanho}>
                        <RTableCell className="text-4xl font-extrabold text-zinc-600">{item.tamanho}</RTableCell>
                        <RTableCell className="text-center text-4xl font-semibold text-zinc-700">{item.qtd}</RTableCell>
                      </RTableRow>
                    ))}
                    <RTableRow className="bg-zinc-800 text-white">
                      <RTableCell className="text-2xl font-black">TOTAL GERAL</RTableCell>
                      <RTableCell className="text-center text-4xl font-black text-[#ff7a1a]">{totalCamisetasResumo}</RTableCell>
                    </RTableRow>
                  </RTableBody>
                </RTable>
              </div>
            )}

            <div className="mt-6 flex justify-center">
              <Button type="button" className="bg-[#f25c05] px-8 text-white hover:bg-[#d94f04]" onClick={() => setRelatorioCamisetasOpen(false)}>
                Fechar Relatório
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!participanteEmEdicao && !!formParticipante}
        onOpenChange={open => {
          if (!open && !salvandoParticipante) {
            setParticipanteEmEdicao(null)
            setFormParticipante(null)
            setAbaParticipante('dados')
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0" showCloseButton={false}>
          <div className="flex items-center justify-between rounded-t-xl bg-[#f25c05] px-6 py-4 text-white">
            <DialogHeader className="gap-0">
              <DialogTitle className="flex items-center gap-2 text-3xl font-black text-white">
                <Pencil className="h-6 w-6" />
                Ficha Completa do Participante
              </DialogTitle>
            </DialogHeader>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => {
                setParticipanteEmEdicao(null)
                setFormParticipante(null)
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {formParticipante && (
            <div className="space-y-4 bg-zinc-50 px-5 py-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
                <strong>Atenção:</strong> Estes dados foram preenchidos pelo participante no Check-in.<br />
                Alterações aqui impactam diretamente o registro oficial.
              </div>

              <Button
                type="button"
                className="h-12 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={!formParticipante.comprovante_url}
                onClick={() => {
                  if (!formParticipante.comprovante_url) {
                    toast.info(
                      pagamentoConfirmado(formParticipante.status_pagamento)
                        ? 'Comprovante ainda não disponível para este participante'
                        : 'Link de pagamento ainda não disponível para este participante',
                    )
                    return
                  }
                  window.open(formParticipante.comprovante_url, '_blank', 'noopener,noreferrer')
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                {pagamentoConfirmado(formParticipante.status_pagamento) ? 'Abrir Comprovante' : 'Abrir Pagamento'}
              </Button>
              <p className="text-center text-xs text-zinc-500">
                Status atual: <strong>{formParticipante.status_pagamento || 'Pendente'}</strong>
              </p>

              <div className="flex flex-wrap gap-2 border-b border-orange-200 pb-3">
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${abaParticipante === 'dados' ? 'bg-[#f25c05] text-white' : 'text-[#f25c05] hover:bg-orange-50'}`}
                  onClick={() => setAbaParticipante('dados')}
                >
                  Dados Pessoais
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${abaParticipante === 'treino' ? 'bg-[#f25c05] text-white' : 'text-[#f25c05] hover:bg-orange-50'}`}
                  onClick={() => setAbaParticipante('treino')}
                >
                  Dados do Treino
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${abaParticipante === 'perfil' ? 'bg-[#f25c05] text-white' : 'text-[#f25c05] hover:bg-orange-50'}`}
                  onClick={() => setAbaParticipante('perfil')}
                >
                  Jurídico & Perfil
                </button>
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm">
                {abaParticipante === 'dados' && (
                  <div className="grid gap-4 md:grid-cols-12">
                    <div className="md:col-span-12">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Nome Completo</label>
                      <Input value={formParticipante.nome} readOnly />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">CPF</label>
                      <Input value={formParticipante.cpf} readOnly />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Data Nascimento</label>
                      <Input type="date" value={formParticipante.nascimento} readOnly />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Whatsapp</label>
                      <Input
                        inputMode="tel"
                        maxLength={16}
                        value={formParticipante.whatsapp}
                        onChange={e => setFormParticipante(prev => prev ? { ...prev, whatsapp: formatPhoneBR(e.target.value) } : prev)}
                      />
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">E-mail</label>
                      <Input type="email" value={formParticipante.email} onChange={e => setFormParticipante(prev => prev ? { ...prev, email: e.target.value } : prev)} />
                    </div>
                    <div className="md:col-span-8">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Cidade</label>
                      <Input value={formParticipante.cidade} readOnly />
                    </div>
                    <div className="md:col-span-4">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">UF</label>
                      <Input value={formParticipante.uf} maxLength={2} readOnly />
                    </div>
                  </div>
                )}

                {abaParticipante === 'treino' && (
                  <div className="grid gap-4 md:grid-cols-12">
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-[#f25c05]">Tamanho Camiseta</label>
                      <select
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        value={formParticipante.tamanho_camiseta}
                        onChange={e => setFormParticipante(prev => prev ? { ...prev, tamanho_camiseta: e.target.value } : prev)}
                      >
                        <option value="">-</option>
                        <option value="Único">Único</option>
                        <option value="P">P</option>
                        <option value="M">M</option>
                        <option value="G">G</option>
                        <option value="GG">GG</option>
                        <option value="XG">XG</option>
                      </select>
                    </div>
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-sm font-semibold text-emerald-700">Nível de Corrida</label>
                      <select
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        value={formParticipante.modalidade_distancia}
                        disabled
                      >
                        <option value="">-</option>
                        <option value="Treino Livre">Treino Livre</option>
                        <option value="Caminhada ou 3 Km">Caminhada ou 3 Km</option>
                        <option value="Corrida 5 Km">Corrida 5 Km</option>
                        <option value="Corrida 10 Km">Corrida 10 Km</option>
                      </select>
                    </div>
                    <div className="md:col-span-12">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Objetivo Principal</label>
                      <Input value={formParticipante.objetivo} readOnly />
                    </div>
                    <div className="md:col-span-12">
                      <label className="mb-1 block text-sm font-semibold text-zinc-700">Observações / Notas da Equipe</label>
                      <textarea
                        className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        value={formParticipante.observacoes}
                        readOnly
                        placeholder="Anote aqui restrições ou pedidos especiais..."
                      />
                    </div>
                  </div>
                )}

                {abaParticipante === 'perfil' && (
                  <div className="space-y-5">
                    <div>
                      <h4 className="mb-3 border-b pb-2 text-sm font-black text-[#f25c05]">Perfil Esportivo</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Tempo de Prática</label>
                          <Input value={formParticipante.tempo_pratica} readOnly />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Tem Assessoria?</label>
                          <Input value={formParticipante.tem_assessoria} readOnly />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-3 border-b pb-2 text-sm font-black text-rose-500">Jurídico e Segurança</h4>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Apto Físico</label>
                          <Input value={boolToLabel(formParticipante.apto_fisico)} readOnly />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Termo Resp.</label>
                          <Input value={boolToLabel(formParticipante.termo_responsabilidade)} readOnly />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Uso Imagem</label>
                          <Input value={boolToLabel(formParticipante.uso_imagem)} readOnly />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-3 border-b pb-2 text-sm font-black text-emerald-600">Marketing & Leads</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Interesse na Assessoria?</label>
                          <Input value={formParticipante.interesse_assessoria ? 'Sim, quero conhecer!' : 'Não'} readOnly />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Formato de Interesse</label>
                          <Input value={formParticipante.formato_interesse} readOnly />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-semibold text-zinc-700">Como Conheceu</label>
                          <Input value={formParticipante.como_conheceu} readOnly />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="rounded-b-none border-t-0 bg-transparent px-1 pb-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setParticipanteEmEdicao(null)
                    setFormParticipante(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" className="bg-[#f25c05] hover:bg-[#d84f00]" onClick={salvarParticipante} disabled={salvandoParticipante}>
                  {salvandoParticipante ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modalTreinoOpen} onOpenChange={setModalTreinoOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-[#f25c05]">
              <Timer className="h-5 w-5" /> Novo Treino / Evento Próprio
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-8 space-y-1">
                <label className="text-sm font-semibold">Nome do Treino</label>
                <Input
                  value={formTreino.nome}
                  onChange={e => setFormTreino(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Treino Ibirapuera"
                />
              </div>
              <div className="col-span-4 space-y-1">
                <label className="text-sm font-semibold">Horário</label>
                <Input
                  type="time"
                  value={formTreino.hora}
                  onChange={e => setFormTreino(p => ({ ...p, hora: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-6 space-y-1">
                <label className="text-sm font-semibold">Data</label>
                <Input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={formTreino.data}
                  onChange={e => setFormTreino(p => ({ ...p, data: e.target.value }))}
                />
              </div>
              <div className="col-span-6 space-y-1">
                <label className="text-sm font-semibold">Qtd. Vagas</label>
                <Input
                  type="number"
                  min={1}
                  value={formTreino.qtd}
                  onChange={e => setFormTreino(p => ({ ...p, qtd: Number(e.target.value || 0) }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold">Local (Cadastrados)</label>
              <button
                type="button"
                className="w-full h-10 rounded-lg border border-input px-3 text-sm text-left flex items-center justify-between hover:bg-muted/40"
                onClick={() => setModalLocalOpen(true)}
              >
                <span className={localSelecionado ? 'text-foreground' : 'text-muted-foreground'}>
                  {localSelecionado ? localSelecionado.nome : 'Selecione um local...'}
                </span>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </button>
              {localSelecionado && (
                <p className="text-xs text-muted-foreground">
                  {localSelecionado.cidade} - {localSelecionado.uf}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold">Distância do Treino (KM)</label>
              <div className="flex rounded-lg border border-input overflow-hidden">
                <Input
                  type="number"
                  min={0}
                  className="border-0 rounded-none"
                  placeholder="Ex: 5"
                  value={formTreino.km}
                  onChange={e => setFormTreino(p => ({ ...p, km: e.target.value }))}
                />
                <span className="inline-flex items-center px-4 text-muted-foreground border-l">km</span>
              </div>
            </div>

            <div className="rounded-lg bg-amber-100 text-amber-900 px-3 py-2 text-sm">
              Este evento será criado com o status <strong>Confirmado</strong>.
            </div>

            <Button type="button" onClick={criarTreino} disabled={salvandoTreino} className="w-full h-11 bg-[#f25c05] hover:bg-[#d84f00]">
              {salvandoTreino ? 'Criando...' : 'Criar Evento Agora'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!participanteParaExcluir}
        onOpenChange={open => {
          if (!open && !excluindoParticipante) {
            setParticipanteParaExcluir(null)
          }
        }}
        title="Excluir participante"
        description={`Tem certeza que deseja excluir ${participanteParaExcluir?.nome || 'este participante'}? Esta ação não pode ser desfeita.`}
        onConfirm={confirmarExclusaoParticipante}
        confirmLabel={excluindoParticipante ? 'Excluindo...' : 'Excluir'}
        confirmDisabled={excluindoParticipante}
        destructive
      />

      <Dialog open={modalLocalOpen} onOpenChange={setModalLocalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Selecionar Local do Evento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome, cidade ou UF..."
                value={buscaLocal}
                onChange={e => setBuscaLocal(e.target.value)}
                autoFocus
              />
            </div>

            {loadingLocais ? (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando locais...</p>
            ) : locaisFiltrados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum local encontrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
                {locaisFiltrados.map(local => (
                  <button
                    key={local.id}
                    type="button"
                    onClick={() => {
                      setFormTreino(p => ({ ...p, localId: local.id }))
                      setModalLocalOpen(false)
                    }}
                    className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/30 ${
                      formTreino.localId === local.id ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <p className="font-semibold text-sm">{local.nome}</p>
                    <p className="text-xs text-muted-foreground">{local.cidade} - {local.uf}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Capacidade máxima: {local.capacidade_maxima ?? 'Não informada'} pessoas
                    </p>
                  </button>
                ))}
              </div>
            )}

            {formTreino.localId && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormTreino(p => ({ ...p, localId: '' }))}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Limpar local selecionado
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
