'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, ChevronDown, ChevronUp, CircleHelp, Download, ExternalLink, FileArchive, FileSpreadsheet, FileText, Image as ImageIcon, ListOrdered, LogOut, Menu, User, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { findHelpSectionByPath } from '@/lib/help-center'
import { abrirPreviewProposta, PropostaPdfData } from '@/lib/proposta-pdf'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/useAuth'
import { empresas, notificacoes, Notificacao, orcamentos, PropostaDetalhe } from '@/lib/api'

interface TopbarProps {
  onMenuClick: () => void
}

type TutorialStep = {
  id: string
  titulo: string
  descricao: string
  material?: {
    name: string
    mime: string
    dataUrl: string
  }
  print?: {
    name: string
    mime: string
    dataUrl: string
  }
}

type MaterialAnexo = {
  name: string
  mime: string
  dataUrl: string
}

type HelpEntry = {
  id: string
  sectionId: string
  ordem?: number
  titulo: string
  instrucoesHtml: string
  anexo?: MaterialAnexo
  tituloAnexo?: string
  capa?: MaterialAnexo
  videoLink?: string
  tutorialPasso: boolean
  passos: TutorialStep[]
}

const HELP_ENTRIES_STORAGE_KEY = 'aomenos1km-help-entries-v1'
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [helpOpen, setHelpOpen] = useState(false)
  const [expandedHelpEntryId, setExpandedHelpEntryId] = useState<string | null>(null)
  const [notifs, setNotifs] = useState<Notificacao[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [helpEntries, setHelpEntries] = useState<HelpEntry[]>([])
  const notifOpenRef = useRef(false)
  const notificacoesInicializadasRef = useRef(false)
  const notificacoesIdsRef = useRef<Set<string>>(new Set())
  const currentHelpSection = findHelpSectionByPath(pathname)

  const carregarNotificacoes = useCallback(() => {
    notificacoes
      .listar()
      .then(r => {
        const proximas = (r.data as Notificacao[]).filter(n => !n.lida)
        const haNova = proximas.some(n => !notificacoesIdsRef.current.has(n.id))

        setNotifs(proximas)
        notificacoesIdsRef.current = new Set(proximas.map(n => n.id))

        if (notificacoesInicializadasRef.current && haNova && !notifOpenRef.current) {
          setNotifOpen(true)
        }
        if (notificacoesInicializadasRef.current && haNova) {
          window.dispatchEvent(new CustomEvent('aomenos-refresh'))
        }
        notificacoesInicializadasRef.current = true
      })
      .catch(() => toast.error('Erro ao carregar notificações'))
  }, [])

  useEffect(() => {
    notifOpenRef.current = notifOpen
  }, [notifOpen])

  useEffect(() => {
    carregarNotificacoes()
    const timer = window.setInterval(() => carregarNotificacoes(), 60000)
    return () => window.clearInterval(timer)
  }, [carregarNotificacoes])

  useEffect(() => {
    notificacoesIdsRef.current = new Set(notifs.map(n => n.id))
  }, [notifs])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const token = sessionStorage.getItem('token')
    if (!token) return

    let ativo = true
    const controller = new AbortController()
    let reconnectTimer: number | null = null

    const conectar = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/notificacoes/stream`, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!resp.ok || !resp.body) {
          throw new Error('Falha ao abrir stream de notificacoes')
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
              .map(l => l.trim())
              .filter(Boolean)

            if (lines.length === 0) continue

            let eventName = 'message'
            const dataLines: string[] = []

            for (const line of lines) {
              if (line.startsWith(':')) continue
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim()
                continue
              }
              if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim())
              }
            }

            if (eventName !== 'notificacao_nova' || dataLines.length === 0) continue

            try {
              const notif = JSON.parse(dataLines.join('\n')) as Notificacao
              setNotifs(prev => {
                if (prev.some(item => item.id === notif.id)) return prev
                return [notif, ...prev].slice(0, 50)
              })
              window.dispatchEvent(new CustomEvent('aomenos-refresh'))
              if (!notifOpenRef.current) {
                setNotifOpen(true)
              }
            } catch {
              // ignora payload invalido
            }
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
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
      }
    }
  }, [])

  useEffect(() => {
    if (notifOpen) {
      carregarNotificacoes()
    }
  }, [notifOpen, carregarNotificacoes])

  const initials = user?.nome
    ?.split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase() ?? 'U'

  async function marcarLida(id: string) {
    try {
      await notificacoes.marcarLida(id)
      setNotifs(prev => prev.filter(n => n.id !== id))
      return true
    } catch {
      toast.error('Não foi possível atualizar a notificação')
      return false
    }
  }

  function isNotificacaoParticipantesEvento(n: Notificacao) {
    if (!n.contrato_id || n.proposta_id) return false
    const autorNome = (n.autor_nome || '').toLowerCase()
    const autorPerfil = (n.autor_perfil || '').toLowerCase()
    const texto = `${n.titulo || ''} ${n.mensagem || ''}`.toLowerCase()
    return autorNome === 'sistema'
      && autorPerfil.includes('automa')
      && /(check-in|vagas|lotad|lista)/.test(texto)
  }

  function abrirNotificacao(n: Notificacao) {
    if (n.proposta_id) {
      router.push('/dashboard/historico-propostas')
      return
    }
    if (n.contrato_id) {
      if (isNotificacaoParticipantesEvento(n)) {
        router.push(`/dashboard/gestao-evento?evento=${encodeURIComponent(n.contrato_id)}`)
        return
      }
      router.push(`/dashboard/contratos/${n.contrato_id}`)
    }
  }

  function formatarHorarioNotificacao(value?: string) {
    if (!value) return '--:--'
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return '--:--'
    return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function toPdfData(p: PropostaDetalhe, documentoEmpresa?: string, enderecoEmpresa?: string, consultorNome?: string): PropostaPdfData {
    return {
      nomeEmpresa: p.empresa_nome || 'Cliente não informado',
      documentoEmpresa: documentoEmpresa || '-',
      responsavel: p.responsavel,
      consultorNome: consultorNome || user?.nome || undefined,
      enderecoEmpresa: enderecoEmpresa || 'Não informado',
      eventoNome: p.evento_nome || 'Evento não informado',
      dataEvento: p.data_evento,
      qtdPessoas: Number(p.qtd_pessoas || 0),
      kmEvento: Number(p.km_evento || 0),
      localNome: p.local_nome || 'A Definir',
      cidadeEvento: p.cidade_evento || '-',
      totalGeral: Number(p.valor_total || 0),
      itens: (p.itens ?? []).map(i => ({
        nome: i.nome,
        descricao: i.descricao || '-',
        qtd: Number(i.quantidade || 0),
        valorUnit: Number(i.valor_unitario || 0),
      })),
    }
  }

  async function abrirPdfNotificacao(n: Notificacao) {
    if (!n.proposta_id) {
      if (n.contrato_id) {
        const ok = await marcarLida(n.id)
        if (!ok) return
        if (isNotificacaoParticipantesEvento(n)) {
          router.push(`/dashboard/gestao-evento?evento=${encodeURIComponent(n.contrato_id)}`)
          return
        }
        router.push(`/dashboard/contratos/${n.contrato_id}`)
      }
      return
    }

    try {
      const rp = await orcamentos.buscarProposta(n.proposta_id)
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
          // segue sem documento/endereco
        }
      }

      const okPreview = await abrirPreviewProposta(
        toPdfData(p, documento, endereco, n.autor_nome || user?.nome),
        `Proposta_${(p.empresa_nome || 'Cliente').substring(0, 20).trim().replace(/\s+/g, '_')}_${p.id.slice(0, 8)}`,
      )
      if (!okPreview) {
        toast.error('Bloqueador de pop-ups ativo. Permita pop-ups para este site e tente novamente.')
        return
      }

      if (p.status === 'Rascunho') {
        await orcamentos.atualizarStatusProposta(p.id, 'Finalizada')
      }
    } catch {
      toast.error('Não foi possível abrir o PDF da proposta')
    }
  }

  async function limparTodasNotificacoes() {
    try {
      await notificacoes.marcarTodasLidas()
      setNotifs([])
      toast.success('Notificações limpas')
    } catch {
      toast.error('Não foi possível limpar as notificações')
    }
  }

  function htmlToPlainText(html: string) {
    if (!html) return ''
    const temp = document.createElement('div')
    temp.innerHTML = html
    return (temp.textContent || temp.innerText || '').replace(/\s+/g, ' ').trim()
  }

  function ensureLinksOpenInNewTab(html: string) {
    if (!html) return html
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      doc.querySelectorAll('a').forEach(anchor => {
        anchor.setAttribute('target', '_blank')
        anchor.setAttribute('rel', 'noopener noreferrer')
      })
      return doc.body.innerHTML
    } catch {
      return html
    }
  }

  function loadHelpEntriesForCurrentSection() {
    function sortHelpEntries(a: HelpEntry, b: HelpEntry) {
      const aOrdem = a.ordem ?? Number.MAX_SAFE_INTEGER
      const bOrdem = b.ordem ?? Number.MAX_SAFE_INTEGER
      if (aOrdem !== bOrdem) return aOrdem - bOrdem
      return a.id.localeCompare(b.id)
    }

    try {
      const raw = localStorage.getItem(HELP_ENTRIES_STORAGE_KEY)
      if (!raw || !currentHelpSection?.id) {
        setHelpEntries([])
        return
      }
      const parsed = JSON.parse(raw) as HelpEntry[]
      const filtered = parsed
        .filter(entry => entry.sectionId === currentHelpSection.id)
        .sort(sortHelpEntries)
      setHelpEntries(filtered)
    } catch {
      setHelpEntries([])
    }
  }

  useEffect(() => {
    if (!helpOpen) return
    loadHelpEntriesForCurrentSection()
  }, [helpOpen, currentHelpSection?.id])

  useEffect(() => {
    setExpandedHelpEntryId(null)
  }, [helpEntries])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== HELP_ENTRIES_STORAGE_KEY || !helpOpen) return
      loadHelpEntriesForCurrentSection()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [helpOpen, currentHelpSection?.id])

  function getAttachmentMeta(anexo?: MaterialAnexo) {
    if (!anexo) return null
    const mime = anexo.mime.toLowerCase()
    if (mime.includes('pdf')) return { label: 'Baixar PDF', color: 'bg-[#dc3545]', icon: FileArchive }
    if (mime.includes('sheet') || mime.includes('excel') || anexo.name.toLowerCase().endsWith('.xlsx')) return { label: 'Baixar Planilha', color: 'bg-[#198754]', icon: FileSpreadsheet }
    if (mime.includes('image')) return { label: 'Baixar Imagem', color: 'bg-[#6f42c1]', icon: ImageIcon }
    return { label: 'Baixar Arquivo', color: 'bg-[#0d6efd]', icon: FileText }
  }

  function getEmbedVideoUrl(link?: string) {
    if (!link) return null

    if (link.includes('youtube.com/watch?v=')) {
      const id = link.split('v=')[1]?.split('&')[0]
      if (id) return `https://www.youtube.com/embed/${id}`
    }
    if (link.includes('youtu.be/')) {
      const id = link.split('youtu.be/')[1]?.split('?')[0]
      if (id) return `https://www.youtube.com/embed/${id}`
    }
    if (link.includes('drive.google.com/file/d/')) {
      const id = link.split('/file/d/')[1]?.split('/')[0]
      if (id) return `https://drive.google.com/file/d/${id}/preview`
    }
    return null
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 border-b bg-background/95 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mr-1 h-9 w-9 rounded-md border border-[#f45a06]/35 bg-[#fff7f2] text-[#f45a06] hover:bg-[#ffe9db] hover:text-[#d94f05] dark:border-orange-500/50 dark:bg-orange-950/30 dark:text-orange-400 dark:hover:bg-orange-900/50 dark:hover:text-orange-300"
        onClick={() => setHelpOpen(true)}
        title="Ajuda contextual"
      >
        <CircleHelp className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </Button>

      {/* Notificações */}
      <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'relative transition-colors',
                notifs.length > 0 && 'bg-[#fff4eb] text-[#f45a06] hover:bg-[#ffe7d6] hover:text-[#e25205] dark:bg-orange-950/30 dark:text-orange-400 dark:hover:bg-orange-900/50 dark:hover:text-orange-300'
              )}
            />
          }
        >
          <Bell className={cn('h-5 w-5', notifs.length > 0 && 'bell-ringing')} />
          {notifs.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center font-bold dark:bg-orange-500 dark:text-white dark:border-orange-400"
            >
              {notifs.length > 9 ? '9+' : notifs.length}
            </Badge>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[360px] rounded-2xl border-0 bg-[#f45a06] p-0 text-white shadow-2xl">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center justify-between gap-2 px-4 py-3 text-white">
              <span>Notificações</span>
              <Badge className="h-6 min-w-6 rounded-full bg-white px-2 text-xs font-bold text-[#171417] hover:bg-white">
                {notifs.length} novas
              </Badge>
              {notifs.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-white/90 hover:text-white"
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    void limparTodasNotificacoes()
                  }}
                >
                  Limpar todas
                </button>
              )}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="bg-white/20" />
          {notifs.length === 0 ? (
            <p className="px-3 py-5 text-sm text-white/90 text-center">
              Nenhuma notificação nova
            </p>
          ) : (
            notifs.slice(0, 8).map(n => (
              <DropdownMenuItem
                key={n.id}
                className="m-2 flex cursor-pointer items-start gap-2 rounded-xl border border-black/10 bg-white p-3 text-[#171417] hover:bg-white/95"
                onClick={() => void abrirNotificacao(n)}
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-extrabold leading-tight line-clamp-1">{n.titulo}</span>
                  <span className="mt-1 block text-sm font-semibold leading-tight line-clamp-2">{n.mensagem}</span>
                  <span className="mt-1 block text-xs text-[#5f646d] line-clamp-1">
                    Por: {n.autor_nome || 'Sistema'} {n.autor_perfil ? `${n.autor_perfil} ` : ''}às {formatarHorarioNotificacao(n.criado_em)}
                  </span>
                </div>

                {(n.proposta_id || n.contrato_id) && (
                  <button
                    type="button"
                    className="shrink-0 text-[#dc3545] hover:text-[#b4202f]"
                    title="Abrir PDF"
                    aria-label="Abrir PDF"
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      void abrirPdfNotificacao(n)
                    }}
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  className="shrink-0 text-[#5f646d] hover:text-[#171417]"
                  title="Marcar como lida"
                  aria-label="Marcar como lida"
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    void marcarLida(n.id)
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Usuário */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="ml-1 gap-2 px-2" />}>
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:block text-sm font-medium max-w-32 truncate">
            {user?.nome}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col">
              <span>{user?.nome}</span>
              <span className="text-xs font-normal text-muted-foreground">{user?.perfil}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            Perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className={cn('w-[96vw] max-w-[96vw] p-0 overflow-hidden sm:max-w-[92vw] lg:w-[1200px] lg:max-w-[92vw] xl:w-[1320px]')}>
          <DialogHeader className="bg-[#f45a06] px-5 py-4 text-white">
            <DialogTitle className="text-lg font-bold text-white">{currentHelpSection?.label || 'Central de Ajuda'}</DialogTitle>
            <p className="text-sm text-white/90">Dicas da categoria: {currentHelpSection?.category || 'GERAL'}</p>
          </DialogHeader>

          <div className="h-[76vh] min-h-[460px] max-h-[860px] overflow-y-auto px-5 py-6">
            {helpEntries.length > 0 ? (
              <div className="space-y-3">
                {helpEntries.map(entry => {
                  const open = expandedHelpEntryId === entry.id
                  const previewText = htmlToPlainText(entry.instrucoesHtml)
                  const meta = getAttachmentMeta(entry.anexo)
                  const embedUrl = getEmbedVideoUrl(entry.videoLink)
                  return (
                    <div key={entry.id} className="overflow-hidden rounded-lg border border-black/10 bg-card dark:bg-slate-800">
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between px-4 py-3 text-left transition-colors',
                          open ? 'bg-[#c6d8f0] dark:bg-blue-900/40 text-foreground dark:text-white' : 'hover:bg-muted/60 dark:hover:bg-slate-700/50'
                        )}
                        onClick={() => setExpandedHelpEntryId(prev => (prev === entry.id ? null : entry.id))}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold">{entry.titulo}</p>
                          {!open && previewText && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{previewText}</p>}
                        </div>
                        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                      </button>

                      {open && (
                        <div className="space-y-4 border-t px-4 py-4 dark:border-slate-700">
                          {entry.capa && entry.capa.mime.includes('image') && (
                            <div className="rounded-xl border bg-muted/30 dark:bg-slate-700/30 p-2">
                              <img src={entry.capa.dataUrl} alt={entry.titulo} className="mx-auto max-h-[300px] rounded-lg object-contain" />
                            </div>
                          )}

                          {entry.instrucoesHtml && (
                            <div
                              className="prose prose-sm max-w-none text-sm text-foreground dark:text-white dark:prose-invert [&_a]:text-[#0d6efd] dark:[&_a]:text-blue-400 [&_a]:underline [&_a]:underline-offset-2"
                              dangerouslySetInnerHTML={{ __html: ensureLinksOpenInNewTab(entry.instrucoesHtml) }}
                            />
                          )}

                          {entry.tutorialPasso && entry.passos.length > 0 && (
                            <div className="rounded-lg border bg-background dark:bg-slate-700/50 p-3">
                              <p className="mb-4 flex items-center gap-2 text-sm font-bold text-[#f45a06] dark:text-orange-400">
                                <ListOrdered className="h-4 w-4" /> Tutorial Passo a Passo
                              </p>
                              <div>
                                {entry.passos.map((step, idx) => (
                                  <div key={step.id} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f45a06] dark:bg-orange-500 text-xs font-bold text-white">
                                        {idx + 1}
                                      </span>
                                      {idx < entry.passos.length - 1 && <div className="my-1 min-h-[16px] w-0.5 flex-1 bg-[#f45a06]/30 dark:bg-orange-500/30" />}
                                    </div>
                                    <div className={cn('min-w-0 flex-1', idx < entry.passos.length - 1 ? 'pb-4' : '')}>
                                      <p className="font-semibold leading-tight text-foreground dark:text-white">{step.titulo}</p>
                                      {step.descricao && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground dark:text-gray-300">{step.descricao}</p>}

                                      {step.print && step.print.mime.includes('image') && (
                                        <img src={step.print.dataUrl} alt={step.titulo} className="mt-2 max-h-44 rounded-lg border object-contain" />
                                      )}

                                      {step.material && (
                                        <a
                                          href={step.material.dataUrl}
                                          download={step.material.name}
                                          className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#f45a06] px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
                                        >
                                          <Download className="h-3 w-3" /> Acessar Material do Passo
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {entry.anexo && meta && (
                            <div className="rounded-xl border bg-muted/30 dark:bg-slate-700/30 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-600 shadow-sm">
                                    <meta.icon className="h-5 w-5 dark:text-white" />
                                  </span>
                                  <div>
                                    <p className="font-bold text-foreground dark:text-white">{entry.tituloAnexo || entry.anexo.name}</p>
                                    <p className="text-xs text-muted-foreground dark:text-gray-400">Clique ao lado para acessar</p>
                                  </div>
                                </div>
                                <a
                                  href={entry.anexo.dataUrl}
                                  download={entry.anexo.name}
                                  className={cn('inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-white', meta.color)}
                                >
                                  <Download className="h-4 w-4" /> {meta.label}
                                </a>
                              </div>

                              {entry.anexo.mime.includes('image') && (
                                <img src={entry.anexo.dataUrl} alt={entry.anexo.name} className="mx-auto mt-3 max-h-[260px] rounded-lg border object-contain" />
                              )}
                            </div>
                          )}

                          {embedUrl && (
                            <div className="overflow-hidden rounded-xl border">
                              <iframe
                                title={`video-${entry.id}`}
                                src={embedUrl}
                                className="h-[380px] w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : currentHelpSection?.topics && currentHelpSection.topics.length > 0 ? (
              <div className="space-y-3">
                {currentHelpSection.topics.map(topic => (
                  <div key={topic.id} className="rounded-lg border border-black/10 bg-card dark:bg-slate-800 p-4 dark:hover:bg-slate-700/50 transition-colors">
                    <p className="font-semibold text-foreground dark:text-white">{topic.title}</p>
                    <p className="text-sm text-muted-foreground dark:text-gray-300 mt-1 whitespace-pre-line">{topic.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                <p className="text-xl font-semibold text-muted-foreground">Nenhuma dica para {currentHelpSection?.category || 'esta categoria'} ainda.</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-4">
            <Link
              href="/dashboard/ajuda"
              onClick={() => setHelpOpen(false)}
              className={cn(
                'mx-auto flex w-fit items-center rounded-full border border-[#f45a06] px-4 py-2 text-sm font-semibold text-[#f45a06] hover:bg-[#fff2ea] dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-950/30'
              )}
            >
              Ver Central de Ajuda Completa
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
