'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { contratos, participantes, ContratoPublico, CheckinInput } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, AlertTriangle, ChevronDown, Ticket, UserCheck, PersonStanding, HeartPulse, FileText, Star, CalendarDays, ExternalLink, MapPin, Rocket } from 'lucide-react'

const CAMISETAS = ['P', 'M', 'G', 'GG', 'XG']
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const TEMPOS_PRATICA = ['Estou começando agora', 'Menos de 6 meses', 'Entre 6 meses e 1 ano', 'Mais de 1 ano']
const ASSESSORIA = ['Não, treino por conta própria', 'Sim, com assessoria', 'Não treino com frequência']
const OBJETIVOS = ['Saúde e qualidade de vida', 'Emagrecimento', 'Performance', 'Bem-estar emocional', 'Socialização / Comunidade']
const INTERESSE = ['Sim, quero conhecer!', 'Talvez, gostaria de conversar', 'Não tenho interesse no momento']
const FORMATO_INTERESSE = ['Treinos presenciais', 'Treinos online', 'Comunidade + acompanhamento', 'Empresas / grupos', 'Outro']
const ORIGEM_EVENTO = ['Instagram', 'Indicação', 'Outros']
const MODALIDADES = ['Caminhada ou 3 Km', 'Corrida 5 Km', 'Corrida 10 Km']
const PARTICULAS_NOME = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e'])

function formatCpf(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d)(\d{4})$/, '$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d)(\d{4})$/, '$1-$2')
}

function capitalizeNameSegment(segment: string) {
  return segment.replace(/^[a-zà-ÿ]/, char => char.toUpperCase())
}

function formatPersonName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^ /, '')
    .split(' ')
    .map((word, index) => {
      if (!word) return word
      if (index > 0 && PARTICULAS_NOME.has(word)) return word
      return word
        .split("'")
        .map(part => part.split('-').map(capitalizeNameSegment).join('-'))
        .join("'")
    })
    .join(' ')
}

function empresaEhAomenos1km(empresaNome?: string) {
  const normalized = String(empresaNome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return normalized.includes('aomenos1km')
}

function isCpfValido(cpfRaw: string) {
  const cpf = cpfRaw.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  let soma = 0
  for (let i = 1; i <= 9; i += 1) soma += Number(cpf.substring(i - 1, i)) * (11 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== Number(cpf.substring(9, 10))) return false
  soma = 0
  for (let i = 1; i <= 10; i += 1) soma += Number(cpf.substring(i - 1, i)) * (12 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === Number(cpf.substring(10, 11))
}

function calcularIdade(dataISO?: string) {
  if (!dataISO) return 0
  const nasc = new Date(dataISO)
  if (Number.isNaN(nasc.getTime())) return 0
  const hoje = new Date()
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade -= 1
  return idade
}

async function dispararConfetes() {
  try {
    const confettiModule = await import('canvas-confetti')
    const confetti = confettiModule.default
    confetti({
      particleCount: 200,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#16a34a', '#f25c05', '#ffffff'],
    })
  } catch {
    // Falha silenciosa: animação não é crítica para o fluxo.
  }
}

function CheckinContent() {
  const searchParams = useSearchParams()
  const eventoId = searchParams.get('id') ?? ''
  const eventoSlug = searchParams.get('slug') ?? ''
  const formRef = useRef<HTMLDivElement | null>(null)
  const shirtButtonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const [evento, setEvento] = useState<ContratoPublico | null>(null)
  const [loadingEvento, setLoadingEvento] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [aguardandoPagamento, setAguardandoPagamento] = useState(false)
  const [erroEvento, setErroEvento] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [nomeSucesso, setNomeSucesso] = useState('')
  const [mostrarHeaderMini, setMostrarHeaderMini] = useState(false)
  const [cidades, setCidades] = useState<string[]>([])
  const [carregandoCidades, setCarregandoCidades] = useState(false)
  const [cpfErro, setCpfErro] = useState('')
  const [nascimentoErro, setNascimentoErro] = useState('')

  const [form, setForm] = useState<Partial<CheckinInput>>({
    contrato_id: eventoId,
    apto_fisico: true,
    termo_responsabilidade: false,
    uso_imagem: true,
    interesse_assessoria: true,
    tempo_pratica: TEMPOS_PRATICA[0],
    tem_assessoria: ASSESSORIA[0],
    objetivo: OBJETIVOS[0],
    formato_interesse: '',
  })

  const [participanteID, setParticipanteID] = useState('')
  const confeteDisparadoRef = useRef(false)

  const ehEventoPago = useMemo(() => {
    if (!evento) return false
    const preco = evento.preco_ingresso != null ? Number(evento.preco_ingresso) : 0
    return preco > 0 && empresaEhAomenos1km(evento.empresa_nome)
  }, [evento])

  const valorInscricao = useMemo(() => {
    if (!evento || !ehEventoPago) return 0
    // Preferência: campo explícito preco_ingresso
    if (evento.preco_ingresso != null && Number(evento.preco_ingresso) > 0) {
      return Number(evento.preco_ingresso)
    }
    // Fallback: não exibir valor se não tiver preco_ingresso definido
    return 0
  }, [evento, ehEventoPago])

  const ocultarModalidade = useMemo(() => {
    const empresa = String(evento?.empresa_nome || '').toLowerCase()
    return empresa.includes('aomenos1km') && !ehEventoPago
  }, [evento, ehEventoPago])

  const ocupacaoPct = useMemo(() => {
    if (!evento) return 0
    if (Number.isFinite(evento.percentual_vagas)) {
      return Number(evento.percentual_vagas)
    }
    if (!evento.vagas_total) return 0
    return (Number(evento.vagas_ocupadas || 0) / Number(evento.vagas_total)) * 100
  }, [evento])

  useEffect(() => {
    const idInformado = (eventoId || '').trim()
    const slugInformado = (eventoSlug || '').trim()

    if (!idInformado && !slugInformado) {
      setErroEvento('ID/slug do evento não informado.')
      setLoadingEvento(false)
      return
    }

    setLoadingEvento(true)

    const resolverEvento = async () => {
      try {
        if (slugInformado) {
          const rSlug = await contratos.buscarPublicoPorSlug(slugInformado)
          const dataSlug = rSlug.data as ContratoPublico
          setEvento(dataSlug)
          setForm(prev => ({ ...prev, contrato_id: dataSlug.id }))
          setErroEvento('')
          return
        }

        const rId = await contratos.buscarPublico(idInformado)
        const dataId = rId.data as ContratoPublico
        setEvento(dataId)
        setForm(prev => ({ ...prev, contrato_id: dataId.id }))
        setErroEvento('')
      } catch (errSlug) {
        if (slugInformado && idInformado) {
          try {
            const rId = await contratos.buscarPublico(idInformado)
            const dataId = rId.data as ContratoPublico
            setEvento(dataId)
            setForm(prev => ({ ...prev, contrato_id: dataId.id }))
            setErroEvento('')
            return
          } catch {
            // segue para erro final abaixo
          }
        }

        const msg = errSlug instanceof Error ? errSlug.message : 'Evento não encontrado ou encerrado.'
        setErroEvento(msg)
      } finally {
        setLoadingEvento(false)
      }
    }

    resolverEvento()
  }, [eventoId, eventoSlug])

  const CAPA_PADRAO = '/arte-aomenos1km-corridas-padrao.jpeg'
  const capaUrl = evento?.capa_url || CAPA_PADRAO

  useEffect(() => {
    const onScroll = () => {
      if (!evento) {
        setMostrarHeaderMini(false)
        return
      }
      setMostrarHeaderMini(window.scrollY > window.innerHeight * 0.4)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [evento])

  // ─── Polling para verificar pagamento ──────────────────────────────────────
  useEffect(() => {
    if (!aguardandoPagamento || !participanteID) return

    const intervalo = setInterval(async () => {
      try {
        const resp = await participantes.verificarStatusPagamento(participanteID)
        const status = String(resp?.data?.status || '').toUpperCase()
        const confirmado = Boolean(resp?.data?.pagamento_confirmado)
        const statusPago = status === 'CONFIRMED' || status === 'RECEIVED' || status === 'RECEIVED_IN_CASH' || status === 'CONFIRMADO'
        
        // Se pagamento confirmado, transiciona para sucesso
        if (confirmado || statusPago) {
          setAguardandoPagamento(false)
          setSucesso(true)
          clearInterval(intervalo)
          toast.success('Pagamento confirmado com sucesso!')
        }
      } catch {
        // Silenciosamente continua tentando
      }
    }, 3000) // Verifica a cada 3 segundos

    return () => clearInterval(intervalo)
  }, [aguardandoPagamento, participanteID])

  useEffect(() => {
    const uf = form.uf
    if (!uf) {
      setCidades([])
      return
    }
    const controller = new AbortController()
    setCarregandoCidades(true)
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error('Falha ao carregar cidades')
        const data = (await r.json()) as Array<{ nome: string }>
        setCidades(data.map(c => c.nome))
      })
      .catch(() => setCidades([]))
      .finally(() => setCarregandoCidades(false))
    return () => controller.abort()
  }, [form.uf])

  useEffect(() => {
    if (!sucesso || confeteDisparadoRef.current) return
    confeteDisparadoRef.current = true
    dispararConfetes()
  }, [sucesso])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target
    const normalized =
      name === 'cpf' ? formatCpf(value)
      : name === 'whatsapp' ? formatPhone(value)
      : name === 'nome' ? formatPersonName(value)
      : name === 'email' ? value.toLowerCase().trimStart()
      : value
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : normalized }))
  }

  function validarCpfCampo(value: string) {
    const cpf = String(value || '')
    if (!cpf) return 'CPF obrigatório'
    if (cpf.replace(/\D/g, '').length !== 11 || !isCpfValido(cpf)) return 'CPF inválido'
    return ''
  }

  function validarNascimentoCampo(value?: string) {
    const nascimento = String(value || '')
    if (!nascimento) return 'Data de nascimento obrigatória'
    const data = new Date(nascimento)
    if (Number.isNaN(data.getTime())) return 'Data de nascimento inválida'
    const hoje = new Date()
    if (data > hoje) return 'Data de nascimento não pode ser no futuro'
    const idade = calcularIdade(nascimento)
    if (idade < 3 || idade > 100) return 'Idade fora do permitido (3 a 100 anos)'
    return ''
  }

  function handleShirtKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = CAMISETAS.length - 1
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = index >= last ? 0 : index + 1
      shirtButtonRefs.current[next]?.focus()
      setForm(p => ({ ...p, tamanho_camiseta: CAMISETAS[next] }))
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = index <= 0 ? last : index - 1
      shirtButtonRefs.current[prev]?.focus()
      setForm(p => ({ ...p, tamanho_camiseta: CAMISETAS[prev] }))
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      shirtButtonRefs.current[0]?.focus()
      setForm(p => ({ ...p, tamanho_camiseta: CAMISETAS[0] }))
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      shirtButtonRefs.current[last]?.focus()
      setForm(p => ({ ...p, tamanho_camiseta: CAMISETAS[last] }))
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setForm(p => ({ ...p, tamanho_camiseta: CAMISETAS[index] }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.cpf || !form.whatsapp) {
      toast.error('Nome, CPF e WhatsApp são obrigatórios')
      return
    }
    const erroCpf = validarCpfCampo(String(form.cpf || ''))
    setCpfErro(erroCpf)
    if (erroCpf) {
      toast.error(erroCpf)
      return
    }
    const erroNascimento = validarNascimentoCampo(form.nascimento)
    setNascimentoErro(erroNascimento)
    if (erroNascimento) {
      toast.error(erroNascimento)
      return
    }
    if (!form.termo_responsabilidade) {
      toast.error('Aceite o termo de responsabilidade para continuar')
      return
    }
    if (!form.apto_fisico) {
      toast.error('Confirme que está apto fisicamente para participar')
      return
    }

    setEnviando(true)
    try {
      const resp = await participantes.checkin(form as CheckinInput)
      setNomeSucesso(String(form.nome || 'Atleta'))
      
      const participanteIDRetornado = String(resp?.data?.id || '').trim()
      if (participanteIDRetornado) {
        setParticipanteID(participanteIDRetornado)
      }

      const checkoutRetornado = String(resp?.data?.checkout_url || '').trim()
      if (ehEventoPago && checkoutRetornado) {
        setCheckoutUrl(checkoutRetornado)
        setAguardandoPagamento(true)
        const novaAba = window.open(checkoutRetornado, '_blank', 'noopener,noreferrer')
        if (!novaAba) {
          toast.warning('Não foi possível abrir o pagamento automaticamente. Use o botão para abrir em nova aba.')
        }
      } else if (ehEventoPago) {
        toast.error('Não foi possível gerar o link de pagamento agora. Tente novamente.')
      } else {
        setSucesso(true)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao realizar inscrição')
    } finally {
      setEnviando(false)
    }
  }

  if (loadingEvento) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Skeleton className="h-64 w-full max-w-lg" />
      </main>
    )
  }

  if (erroEvento) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <h2 className="text-lg font-semibold">{erroEvento}</h2>
            <p className="text-sm text-muted-foreground">
              Verifique o link recebido ou entre em contato com o organizador.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (sucesso) {
    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-10">
        <div className="mx-auto max-w-[620px] space-y-5">
          <div className="flex justify-center">
            <img src="/logo-aomenos1km.png" alt="Aomenos1km" className="h-24 w-auto max-w-[260px] object-contain" />
          </div>

          <Card className="border-0 bg-white shadow-lg">
            <CardContent className="space-y-3 pt-8 pb-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-11 w-11 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-black text-zinc-800">Inscrição Confirmada!</h2>
              <p className="text-base text-zinc-600">
                Parabéns, <b className="text-orange-600">{nomeSucesso || 'Atleta'}</b>! Você garantiu sua vaga no evento.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-md">
            <CardContent className="p-5">
              <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-zinc-800">
                <MapPin className="h-5 w-5 text-orange-500" />
                Onde e quando
              </h3>
              <div className="space-y-2 text-[15px] text-zinc-700">
                <p><b>Local:</b> {evento?.local_nome || '-'}</p>
                <p><b>Data:</b> {evento?.data_evento ? new Date(evento.data_evento).toLocaleDateString('pt-BR') : '-'}</p>
                <p><b>Chegada:</b> a partir das 06h00</p>
                <p><b>Largada oficial:</b> às 07h00</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-md">
            <CardContent className="p-5">
              <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-zinc-800">
                <Rocket className="h-5 w-5 text-orange-500" />
                Modo atleta ativado
              </h3>
              <div className="space-y-2 text-[15px] text-zinc-700">
                <p><b>Hidratação:</b> beba bastante água nos dias anteriores.</p>
                <p><b>Descanso:</b> uma boa noite de sono faz diferença.</p>
                <p><b>Tênis e kit:</b> deixe tudo separado na véspera.</p>
              </div>
              <p className="mt-5 text-center text-lg font-black text-orange-600">Nos vemos na linha de largada!</p>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  if (aguardandoPagamento) {
    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-10">
        <div className="mx-auto max-w-[620px] space-y-5">
          <Card className="border-0 bg-white shadow-lg">
            <CardContent className="space-y-4 pt-8 pb-7 text-center">
              <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
              <h2 className="text-3xl font-black text-zinc-800">Aguardando Pagamento...</h2>
              <p className="text-zinc-600">
                Uma nova aba foi aberta para concluir o pagamento com segurança.
              </p>
              <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-left text-sm text-blue-900">
                <b>✓ Não feche esta página.</b> Assim que o pagamento for confirmado, você será redirecionado automaticamente.
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  className="h-11 bg-zinc-900 text-white hover:bg-zinc-700"
                  onClick={() => {
                    if (checkoutUrl) window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Reabrir tela de pagamento
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  const vagas = evento ? evento.vagas_total - evento.vagas_ocupadas : 0
  const semVagas = vagas <= 0 || ocupacaoPct >= 100
  const statusBadge = semVagas ? 'Inscrições encerradas' : ocupacaoPct >= 85 ? 'Últimas vagas' : 'Inscrições abertas'
  const statusMensagem = semVagas
    ? 'As inscrições para este evento foram encerradas.'
    : ocupacaoPct >= 85
      ? 'O evento está quase esgotado. Corra!'
      : 'Vagas abertas por tempo limitado. Participe!'

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-800">
      {!!evento && (
        <>
          <header
            className={`fixed inset-x-0 top-0 z-40 h-24 overflow-hidden border-b-4 border-orange-500 transition-opacity duration-300 ${mostrarHeaderMini ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          >
            <div
              className="absolute -inset-8 bg-cover bg-center blur-xl"
              style={{ backgroundImage: `url(${capaUrl})` }}
            />
            <div className="absolute inset-0 bg-black/45" />
            <div className="relative z-10 flex h-full items-center justify-center px-4">
              <img src={capaUrl} alt={evento.nome_evento} className="max-h-16 rounded-md object-contain" />
            </div>
          </header>

          <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-zinc-900">
            <div
              className="absolute -inset-10 bg-cover bg-center blur-2xl"
              style={{ backgroundImage: `url(${capaUrl})` }}
            />
            <div className="absolute inset-0 bg-zinc-950/55" />
            <img
              src={capaUrl}
              alt={`Capa ${evento.nome_evento}`}
              className="relative z-10 mx-6 max-h-[72vh] rounded-2xl object-contain shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            />
            <button
              type="button"
              onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="absolute bottom-10 z-20 flex flex-col items-center gap-2 text-white/95"
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Arraste para iniciar</span>
              <ChevronDown className="h-8 w-8 animate-bounce" />
            </button>
          </section>
        </>
      )}

      <div ref={formRef} className="mx-auto max-w-[620px] space-y-5 px-4 pb-14 pt-6">
        <Card className="overflow-hidden border-0 bg-white shadow-lg">
          <CardContent className="space-y-3 p-5 text-center">
            <h1 className="text-[34px] font-black leading-tight text-zinc-800">{evento?.empresa_nome}{evento?.nome_evento && evento?.nome_evento !== evento?.empresa_nome ? ` - ${evento?.nome_evento}` : ''}</h1>
            {evento?.data_evento && (
              <div className="inline-flex items-center gap-2 rounded-md border bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-600">
                <CalendarDays className="h-4 w-4 text-orange-500" />
                {new Date(evento.data_evento).toLocaleDateString('pt-BR')} | {evento?.local_nome}
              </div>
            )}
            <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 px-3 py-4">
              <div className={`mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white ${semVagas ? 'bg-zinc-700' : ocupacaoPct >= 85 ? 'bg-red-600' : 'bg-emerald-600'}`}>
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                {statusBadge}
              </div>
              <p className="text-sm font-bold text-orange-600">
                {statusMensagem}
              </p>
            </div>
          </CardContent>
        </Card>

        {semVagas ? (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="font-semibold text-destructive">Inscrições encerradas</p>
              <p className="mt-1 text-sm text-muted-foreground">Todas as vagas foram preenchidas.</p>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <SectionCard title="Dados Pessoais" icon={<UserCheck className="h-5 w-5 text-orange-500" />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FField label="Nome Completo *" id="nome" className="sm:col-span-2">
                  <Input name="nome" required value={form.nome ?? ''} onChange={handleChange} placeholder="Conforme documento" autoCapitalize="words" />
                </FField>
                <FField label="CPF *" id="cpf">
                  <Input
                    name="cpf"
                    required
                    value={form.cpf ?? ''}
                    onChange={e => {
                      handleChange(e)
                      if (cpfErro) setCpfErro('')
                    }}
                    onBlur={e => setCpfErro(validarCpfCampo(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={cpfErro ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {cpfErro && <p className="text-xs font-semibold text-red-600">{cpfErro}</p>}
                </FField>
                <FField label="Data de Nascimento *" id="nascimento">
                  <Input
                    name="nascimento"
                    type="date"
                    required
                    value={form.nascimento ?? ''}
                    onChange={e => {
                      handleChange(e)
                      if (nascimentoErro) setNascimentoErro('')
                    }}
                    onBlur={e => setNascimentoErro(validarNascimentoCampo(e.target.value))}
                    max={new Date().toISOString().split('T')[0]}
                    className={nascimentoErro ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {nascimentoErro && <p className="text-xs font-semibold text-red-600">{nascimentoErro}</p>}
                </FField>
                <FField label="WhatsApp *" id="whatsapp">
                  <Input name="whatsapp" required value={form.whatsapp ?? ''} onChange={handleChange} placeholder="(99) 99999-9999" maxLength={15} />
                </FField>
                <FField label="E-mail *" id="email">
                  <Input name="email" type="email" required value={form.email ?? ''} onChange={handleChange} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                </FField>
                <FField label="UF *" id="uf">
                  <Select
                    value={form.uf ?? ''}
                    onValueChange={v => setForm(p => ({ ...p, uf: v ?? undefined, cidade: '' }))}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Escolha..." /></SelectTrigger>
                    <SelectContent>
                      {UFS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FField>
                <FField label="Cidade *" id="cidade">
                  <Select
                    value={form.cidade ?? ''}
                    onValueChange={v => setForm(p => ({ ...p, cidade: v ?? undefined }))}
                    disabled={!form.uf || carregandoCidades || cidades.length === 0}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder={carregandoCidades ? 'Carregando...' : 'Selecione a cidade'} /></SelectTrigger>
                    <SelectContent>
                      {cidades.map(cidade => <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FField>
              </div>
            </SectionCard>

            {!ocultarModalidade && (
              <SectionCard title="Modalidade & Kit" icon={<PersonStanding className="h-5 w-5 text-orange-500" />}>
                <div className="space-y-4">
                  <FField label="Como você irá participar? (Modalidade) *" id="modalidade_distancia">
                    <Select
                      value={form.modalidade_distancia ?? ''}
                      onValueChange={v => {
                        setForm(p => ({ ...p, modalidade_distancia: v ?? undefined, tamanho_camiseta: p.tamanho_camiseta || CAMISETAS[0] }))
                        requestAnimationFrame(() => shirtButtonRefs.current[0]?.focus())
                      }}
                    >
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecione sua meta..." /></SelectTrigger>
                      <SelectContent>
                        {MODALIDADES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FField>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-zinc-600">Selecione o tamanho da camiseta:</p>
                    <div className="grid grid-cols-5 gap-2">
                      {CAMISETAS.map(tamanho => (
                        <button
                          key={tamanho}
                          type="button"
                          ref={el => {
                            shirtButtonRefs.current[CAMISETAS.indexOf(tamanho)] = el
                          }}
                          onClick={() => setForm(p => ({ ...p, tamanho_camiseta: tamanho }))}
                          onKeyDown={e => handleShirtKeyDown(e, CAMISETAS.indexOf(tamanho))}
                          tabIndex={form.tamanho_camiseta === tamanho ? 0 : -1}
                          className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${form.tamanho_camiseta === tamanho ? 'border-orange-500 bg-orange-500 text-white shadow' : 'border-zinc-300 bg-white text-zinc-600 hover:border-orange-400 hover:text-orange-600'}`}
                        >
                          {tamanho}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}

            <SectionCard title="Perfil & Saúde" icon={<HeartPulse className="h-5 w-5 text-orange-500" />}>
              <div className="space-y-4">
                <FField label="Há quanto tempo você pratica? *" id="tempo_pratica">
                  <Select value={form.tempo_pratica ?? ''} onValueChange={v => setForm(p => ({ ...p, tempo_pratica: v ?? undefined }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEMPOS_PRATICA.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FField>

                <FField label="Treina com assessoria esportiva? *" id="tem_assessoria">
                  <Select value={form.tem_assessoria ?? ''} onValueChange={v => setForm(p => ({ ...p, tem_assessoria: v ?? undefined }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSESSORIA.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FField>

                <FField label="Qual seu principal objetivo? *" id="objetivo">
                  <Select value={form.objetivo ?? ''} onValueChange={v => setForm(p => ({ ...p, objetivo: v ?? undefined }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OBJETIVOS.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FField>

                <div className="rounded-md border bg-zinc-100 p-3">
                  <p className="mb-2 text-sm">Você está apto(a) para prática de atividade física? *</p>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="apto" checked={!!form.apto_fisico} onChange={() => setForm(p => ({ ...p, apto_fisico: true }))} />
                      Sim
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="apto" checked={!form.apto_fisico} onChange={() => setForm(p => ({ ...p, apto_fisico: false }))} />
                      Não
                    </label>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Termos e Autorizações" icon={<FileText className="h-5 w-5 text-orange-500" />}>
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase text-zinc-500">Termo de Responsabilidade</p>
                <div className="max-h-44 overflow-y-auto rounded-md border bg-zinc-50 p-3 text-[13px] leading-relaxed text-zinc-600">
                  Declaro, para os devidos fins, que estou em plenas condições físicas e de saúde para participar da Corrida Aomenos1km, assumindo total responsabilidade por minha participação.
                  <br />
                  <br />
                  Declaro que:
                  <br />
                  1. Estou ciente de que a atividade envolve esforço físico e possíveis riscos inerentes à prática esportiva;
                  <br />
                  2. Não possuo restrições médicas que impeçam minha participação ou, caso possua, assumo total responsabilidade por elas;
                  <br />
                  3. Autorizo o uso da minha imagem em fotos e vídeos realizados durante o evento para fins institucionais, promocionais e de divulgação do projeto, sem qualquer ônus;
                  <br />
                  4. Isento os organizadores, apoiadores e parceiros de qualquer responsabilidade por eventuais acidentes, lesões ou intercorrências decorrentes da minha participação.
                  <br />
                  5. Estou ciente e autorizo, nos termos da Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), o tratamento dos meus dados pessoais pela Aomenos1km para fins de inscrição, organização e execução do evento, comunicação com participantes, aprimoramento de serviços e envio de conteúdos, campanhas e ofertas relacionadas aos serviços e produtos da Aomenos1km, podendo revogar esse consentimento a qualquer momento pelos canais oficiais de atendimento.
                  <br />
                  <br />
                  <strong>Ao confirmar minha inscrição, declaro que li, compreendi e concordo integralmente com este termo.</strong>
                </div>
                <label className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  <input
                    type="checkbox"
                    name="termo_responsabilidade"
                    checked={!!form.termo_responsabilidade}
                    onChange={handleChange}
                    className="mt-0.5"
                  />
                  Li, compreendi e concordo com o Termo de Responsabilidade e Privacidade (LGPD). *
                </label>
                <p className="pt-1 text-xs font-bold uppercase text-zinc-500">Autorização de Uso de Imagem *</p>
                <div className="flex items-center gap-5 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="uso_imagem_radio" checked={form.uso_imagem !== false} onChange={() => setForm(p => ({ ...p, uso_imagem: true }))} />
                    Autorizo (Sim)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="uso_imagem_radio" checked={form.uso_imagem === false} onChange={() => setForm(p => ({ ...p, uso_imagem: false }))} />
                    Não autorizo
                  </label>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Finalização" icon={<Star className="h-5 w-5 text-orange-500" />}>
              <div className="space-y-4">
                <FField label="Gostaria de informações sobre a Assessoria AoMenos1km?" id="interesse_assessoria">
                  <Select
                    value={form.interesse_assessoria === false ? 'Não tenho interesse no momento' : ((form as Record<string, unknown>).interesse_texto as string) || INTERESSE[0]}
                    onValueChange={v => setForm(p => ({ ...p, interesse_assessoria: v !== 'Não tenho interesse no momento', interesse_texto: v as never }))}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTERESSE.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FField>

                <FField label="Qual formato mais te interessaria?" id="formato_interesse">
                  <Select value={form.formato_interesse ?? ''} onValueChange={v => setForm(p => ({ ...p, formato_interesse: v ?? undefined }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione (Opcional)..." /></SelectTrigger>
                    <SelectContent>
                      {FORMATO_INTERESSE.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FField>

                <FField label="Como conheceu a corrida? *" id="como_conheceu">
                  <Select value={form.como_conheceu ?? ''} onValueChange={v => setForm(p => ({ ...p, como_conheceu: v ?? undefined }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {ORIGEM_EVENTO.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FField>

                <FField label="Observações Finais (Opcional)" id="observacoes">
                  <Input
                    name="observacoes"
                    value={String((form as { observacoes?: string }).observacoes || '')}
                    onChange={e => setForm(p => ({ ...p, observacoes: e.target.value } as Partial<CheckinInput>))}
                    placeholder="Alguma dúvida ou sugestão?"
                  />
                </FField>
              </div>
            </SectionCard>

            {ehEventoPago && (
              <SectionCard title="Pagamento da Inscrição" icon={<Ticket className="h-5 w-5 text-orange-500" />}>
                <div className="rounded-lg border-2 border-dashed border-orange-400 bg-zinc-50 p-4 text-center">
                  <span className="inline-flex rounded-full bg-orange-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    Taxa de Participação
                  </span>
                  <p className="mt-3 text-lg font-semibold text-zinc-600">Valor da sua inscrição:</p>
                  <div className="mt-2 inline-flex rounded-xl bg-orange-500 px-6 py-2 text-5xl font-black text-white shadow">
                    {valorInscricao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <p className="mt-4 text-sm font-bold text-zinc-500">Você será redirecionado para o pagamento seguro.</p>
                </div>
              </SectionCard>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={enviando}
              className="h-14 w-full rounded-full border-2 border-orange-500 bg-white text-base font-extrabold uppercase tracking-wide text-orange-500 hover:bg-orange-500 hover:text-white"
            >
              {enviando ? 'Enviando inscrição...' : ehEventoPago ? 'Ir para o pagamento' : 'Confirmar inscrição'}
            </Button>

            <p className="text-center text-xs text-zinc-500">Aomenos1km · Plataforma de eventos esportivos</p>
          </form>
        )}
      </div>
    </main>
  )
}

export default function CheckinPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </main>
    }>
      <CheckinContent />
    </Suspense>
  )
}

function FField({
  label,
  id,
  children,
  className = '',
}: {
  label: string
  id: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="border-0 bg-white shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 border-b pb-3 text-[30px] font-black text-zinc-700">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
