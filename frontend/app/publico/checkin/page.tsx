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
import { CheckCircle2, AlertTriangle, ChevronDown, Ticket, UserCheck, PersonStanding, HeartPulse, FileText, Star, CalendarDays, ExternalLink, MapPin, Rocket, Info } from 'lucide-react'

const CAMISETAS = ['P', 'M', 'G', 'GG', 'XG']
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const TEMPOS_PRATICA = ['Estou começando agora', 'Menos de 6 meses', 'Entre 6 meses e 1 ano', 'Mais de 1 ano']
const ASSESSORIA = ['Não, treino por conta própria', 'Sim, com assessoria', 'Não treino com frequência']
const OBJETIVOS = ['Saúde e qualidade de vida', 'Emagrecimento', 'Performance', 'Bem-estar emocional', 'Socialização / Comunidade']
const INTERESSE = ['Sim, quero conhecer!', 'Talvez, gostaria de conversar', 'Não tenho interesse no momento']
const FORMATO_INTERESSE = ['Treinos presenciais', 'Treinos online', 'Comunidade + acompanhamento', 'Empresas / grupos', 'Outro']
const ORIGEM_EVENTO = ['Instagram', 'Indicação', 'Outros']
const MODALIDADES = ['Caminhada ou 3 Km', 'Corrida 5 Km', 'Corrida 10 Km']
const RELACIONAMENTOS_DEPENDENTE = ['Filho', 'Filha', 'Neto', 'Neta', 'Sobrinho', 'Sobrinha', 'Cônjuge', 'Outro responsável']
const DETALHES_CONJUGE = ['Esposo', 'Esposa', 'Prefiro não informar', 'Outro']
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

function somenteDigitos(value: string) {
  return String(value || '').replace(/\D/g, '')
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

function normalizarHora(value?: string) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const match = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return ''
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return ''
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function somarUmaHora(hora: string) {
  const match = hora.match(/^(\d{2}):(\d{2})$/)
  if (!match) return ''
  const h = Number(match[1])
  const m = Number(match[2])
  const total = (h * 60 + m + 60) % (24 * 60)
  const nh = Math.floor(total / 60)
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function formatarDataEvento(value?: string) {
  const raw = String(value || '').trim()
  if (!raw) return '-'
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString('pt-BR')
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
  const cpfInputRef = useRef<HTMLInputElement | null>(null)
  const cpfDependenteInputRef = useRef<HTMLInputElement | null>(null)
  const cpfValidacaoSeqRef = useRef(0)
  const shirtButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const dependenteShirtButtonRefs = useRef<Array<Array<HTMLButtonElement | null>>>([])

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
  const [cpfValidando, setCpfValidando] = useState(false)
  const [cpfDuplicadoValor, setCpfDuplicadoValor] = useState('')
  const [cpfDuplicadoMensagem, setCpfDuplicadoMensagem] = useState('')
  const [cpfDependenteErroEvento, setCpfDependenteErroEvento] = useState('')
  const [cpfDependenteValidando, setCpfDependenteValidando] = useState(false)
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
  const [temDependentes, setTemDependentes] = useState(false)
  const [dependentes, setDependentes] = useState<Array<{ nome: string; cpf: string; nascimento: string; relacionamento: string; tamanho_camiseta: string }>>([])
  const [formDependente, setFormDependente] = useState({
    nome: '',
    cpf: '',
    nascimento: '',
    relacionamento: '',
    relacionamento_especifico: '',
    conjuge_detalhe: '',
    conjuge_detalhe_outro: '',
  })
  const [mostrandoFormDependente, setMostrandoFormDependente] = useState(false)
  const confeteDisparadoRef = useRef(false)

  const ehEventoPago = useMemo(() => {
    if (!evento) return false
    const preco = evento.preco_ingresso != null ? Number(evento.preco_ingresso) : 0
    return preco > 0 && empresaEhAomenos1km(evento.empresa_nome)
  }, [evento])

  const ehAomenos1km = useMemo(() => {
    return empresaEhAomenos1km(evento?.empresa_nome)
  }, [evento])

  const permitirDependentes = useMemo(() => {
    return ehAomenos1km
  }, [ehAomenos1km])

  const valorInscricao = useMemo(() => {
    if (!evento || !ehEventoPago) return 0
    // Preferência: campo explícito preco_ingresso
    if (evento.preco_ingresso != null && Number(evento.preco_ingresso) > 0) {
      return Number(evento.preco_ingresso)
    }
    // Fallback: não exibir valor se não tiver preco_ingresso definido
    return 0
  }, [evento, ehEventoPago])

  const totalIngressosSelecionados = useMemo(() => {
    if (!temDependentes) return 1
    return 1 + dependentes.length
  }, [temDependentes, dependentes.length])

  const valorInscricaoTotal = useMemo(() => {
    return valorInscricao * totalIngressosSelecionados
  }, [valorInscricao, totalIngressosSelecionados])

  const ocultarModalidade = useMemo(() => {
    return ehAomenos1km && !ehEventoPago
  }, [ehAomenos1km, ehEventoPago])

  useEffect(() => {
    if (permitirDependentes) return
    setTemDependentes(false)
    setDependentes([])
    setMostrandoFormDependente(false)
    setFormDependente({
      nome: '',
      cpf: '',
      nascimento: '',
      relacionamento: '',
      relacionamento_especifico: '',
      conjuge_detalhe: '',
      conjuge_detalhe_outro: '',
    })
  }, [permitirDependentes])

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

  async function recarregarEventoAtual() {
    const idInformado = (eventoId || '').trim()
    const slugInformado = (eventoSlug || '').trim()
    if (!idInformado && !slugInformado) return

    if (slugInformado) {
      const rSlug = await contratos.buscarPublicoPorSlug(slugInformado)
      const dataSlug = rSlug.data as ContratoPublico
      setEvento(dataSlug)
      setForm(prev => ({ ...prev, contrato_id: dataSlug.id }))
      return
    }

    const rId = await contratos.buscarPublico(idInformado)
    const dataId = rId.data as ContratoPublico
    setEvento(dataId)
    setForm(prev => ({ ...prev, contrato_id: dataId.id }))
  }

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
          try {
            await recarregarEventoAtual()
          } catch {
            // Mesmo sem refresh, mantem fluxo de sucesso.
          }
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

  useEffect(() => {
    const cpfAtual = somenteDigitos(String(form.cpf || ''))
    if (!cpfDuplicadoValor) return

    if (cpfAtual !== cpfDuplicadoValor) {
      setCpfDuplicadoValor('')
      setCpfDuplicadoMensagem('')
      return
    }

    if (!cpfErro) {
      setCpfErro(cpfDuplicadoMensagem || 'Este CPF já está cadastrado neste evento. Use outro CPF para esta inscrição.')
    }
  }, [form.cpf, cpfDuplicadoValor, cpfDuplicadoMensagem, cpfErro])

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

  async function validarCpfCampoComDuplicacao(value: string) {
    const seq = ++cpfValidacaoSeqRef.current
    const erroLocal = validarCpfCampo(value)
    if (erroLocal) {
      if (seq !== cpfValidacaoSeqRef.current) return false
      setCpfErro(erroLocal)
      setCpfDuplicadoValor('')
      setCpfDuplicadoMensagem('')
      return false
    }

    try {
      setCpfValidando(true)
      const validacaoData = await validarDuplicacaoCpfEvento(value)
      if (seq !== cpfValidacaoSeqRef.current) return false
      if (!validacaoData.success) {
        setCpfErro(validacaoData.error || 'Não foi possível validar CPF neste evento')
        setCpfDuplicadoValor('')
        setCpfDuplicadoMensagem('')
        return false
      }

      if (validacaoData.data?.existe || validacaoData.data?.pode_inscrever === false) {
        const msg = validacaoData.data?.mensagem_bloqueio || 'Este CPF já está inscrito neste evento'
        setCpfErro(msg)
        setCpfDuplicadoValor(somenteDigitos(value))
        setCpfDuplicadoMensagem(msg)
        return false
      }

      setCpfErro('')
      setCpfDuplicadoValor('')
      setCpfDuplicadoMensagem('')
      return true
    } catch {
      if (seq !== cpfValidacaoSeqRef.current) return false
      setCpfErro('Não foi possível validar CPF neste evento. Tente novamente.')
      setCpfDuplicadoValor('')
      setCpfDuplicadoMensagem('')
      return false
    } finally {
      if (seq === cpfValidacaoSeqRef.current) {
        setCpfValidando(false)
      }
    }
  }

  function validarCpfDependenteLocal(value: string) {
    const cpfDependente = somenteDigitos(value)
    if (!cpfDependente) return ''
    if (cpfDependente.length !== 11 || !isCpfValido(value)) return 'CPF do dependente inválido'

    const cpfTitular = somenteDigitos(String(form.cpf || ''))
    if (cpfTitular && cpfDependente === cpfTitular) {
      return 'O CPF do dependente não pode ser igual ao do titular'
    }

    const existeNosDependentes = dependentes.some(dep => somenteDigitos(dep.cpf) === cpfDependente)
    if (existeNosDependentes) {
      return 'Este CPF já foi adicionado em outro dependente'
    }

    return ''
  }

  async function validarDuplicacaoCpfEvento(cpf: string) {
    const contratoId = String(form.contrato_id || '').trim()
    if (!contratoId) {
      return { success: true, data: { existe: false, pode_inscrever: true } }
    }

    return participantes.validarDuplicacao(cpf, contratoId)
  }

  async function validarCpfDependenteComDuplicacao(value: string) {
    const erroLocal = validarCpfDependenteLocal(value)
    if (erroLocal) {
      setCpfDependenteErroEvento('')
      return false
    }

    try {
      setCpfDependenteValidando(true)
      const validacaoData = await validarDuplicacaoCpfEvento(value)
      if (!validacaoData.success) {
        setCpfDependenteErroEvento(validacaoData.error || 'Não foi possível validar CPF do dependente neste evento')
        return false
      }
      if (validacaoData.data?.existe || validacaoData.data?.pode_inscrever === false) {
        setCpfDependenteErroEvento(validacaoData.data?.mensagem_bloqueio || 'Este CPF já está cadastrado neste evento. Use outro CPF para esta inscrição.')
        return false
      }

      setCpfDependenteErroEvento('')
      return true
    } catch {
      setCpfDependenteErroEvento('Não foi possível validar CPF do dependente neste evento. Tente novamente.')
      return false
    } finally {
      setCpfDependenteValidando(false)
    }
  }

  const cpfDependenteErro = validarCpfDependenteLocal(formDependente.cpf)

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

  function focusDependenteShirt(depIndex: number, shirtIndex: number) {
    requestAnimationFrame(() => {
      dependenteShirtButtonRefs.current[depIndex]?.[shirtIndex]?.focus()
    })
  }

  function handleDependenteShirtKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    depIndex: number,
    shirtIndex: number,
  ) {
    const last = CAMISETAS.length - 1

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = shirtIndex >= last ? 0 : shirtIndex + 1
      atualizarTamanhoDependente(depIndex, CAMISETAS[next])
      focusDependenteShirt(depIndex, next)
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = shirtIndex <= 0 ? last : shirtIndex - 1
      atualizarTamanhoDependente(depIndex, CAMISETAS[prev])
      focusDependenteShirt(depIndex, prev)
      return
    }

    if (e.key === 'Home') {
      e.preventDefault()
      atualizarTamanhoDependente(depIndex, CAMISETAS[0])
      focusDependenteShirt(depIndex, 0)
      return
    }

    if (e.key === 'End') {
      e.preventDefault()
      atualizarTamanhoDependente(depIndex, CAMISETAS[last])
      focusDependenteShirt(depIndex, last)
      return
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      atualizarTamanhoDependente(depIndex, CAMISETAS[shirtIndex])
    }
  }

  function atualizarTamanhoDependente(index: number, tamanho: string) {
    setDependentes(prev => prev.map((dep, i) => (i === index ? { ...dep, tamanho_camiseta: tamanho } : dep)))
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
      cpfInputRef.current?.focus()
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

    setEnviando(true)
    try {
      // Valida duplicação de CPF antes de submeter inscrição
      const validacaoData = await validarDuplicacaoCpfEvento(String(form.cpf || ''))
      if (!validacaoData.success) {
        const msg = validacaoData.error || 'Erro ao validar inscrição'
        setCpfErro(msg)
        setCpfDuplicadoValor('')
        setCpfDuplicadoMensagem('')
        toast.error(msg)
        cpfInputRef.current?.focus()
        setEnviando(false)
        return
      }

      if (validacaoData.data?.existe) {
        const msg = validacaoData.data?.mensagem_bloqueio || 'Este CPF já está cadastrado neste evento. Use outro CPF para esta inscrição.'
        setCpfErro(msg)
        setCpfDuplicadoValor(somenteDigitos(String(form.cpf || '')))
        setCpfDuplicadoMensagem(msg)
        toast.error(msg)
        cpfInputRef.current?.focus()
        setEnviando(false)
        return
      }

      const payload: CheckinInput = {
        ...(form as CheckinInput),
        dependentes: permitirDependentes && temDependentes
          ? dependentes.map(dep => ({
              nome: dep.nome,
              cpf: dep.cpf,
              nascimento: dep.nascimento,
              relacionamento: dep.relacionamento,
              tamanho_camiseta: String(dep.tamanho_camiseta || '').trim().toUpperCase() || 'P',
            }))
          : [],
      }

      const resp = await participantes.checkin(payload)
      setNomeSucesso(String(form.nome || 'Atleta'))
      try {
        await recarregarEventoAtual()
      } catch {
        // Falha no refresh não deve bloquear confirmação da inscrição.
      }
      
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

  const horaChegadaEvento = normalizarHora(evento?.hora_chegada)
  const horaLargadaEvento = horaChegadaEvento ? somarUmaHora(horaChegadaEvento) : ''
  const horaChegadaLabel = horaChegadaEvento ? `a partir das ${horaChegadaEvento.replace(':', 'h')}` : 'a definir'
  const horaLargadaLabel = horaLargadaEvento ? `as ${horaLargadaEvento.replace(':', 'h')}` : 'a definir'

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
                <p><b>Data:</b> {formatarDataEvento(evento?.data_evento)}</p>
                <p><b>Chegada:</b> {horaChegadaLabel}</p>
                <p><b>Largada oficial:</b> {horaLargadaLabel}</p>
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
                    ref={cpfInputRef}
                    name="cpf"
                    required
                    value={form.cpf ?? ''}
                    onChange={e => {
                      handleChange(e)
                      const cpfAtual = somenteDigitos(e.target.value)
                      if (cpfAtual !== cpfDuplicadoValor && cpfErro) {
                        setCpfErro('')
                        setCpfDuplicadoValor('')
                        setCpfDuplicadoMensagem('')
                      }
                    }}
                    onBlur={e => {
                      void validarCpfCampoComDuplicacao(e.target.value)
                    }}
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

                <FField label="Como você se identifica? (Opcional)" id="genero_identidade" className="sm:col-span-2">
                  <Select
                    value={(form as Record<string, unknown>).genero_identidade as string ?? ''}
                    onValueChange={v => setForm(p => ({ ...p, genero_identidade: v ?? undefined } as Partial<CheckinInput>))}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Escolha (opcional)..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Prefiro não informar</SelectItem>
                      <SelectItem value="Homem">Homem</SelectItem>
                      <SelectItem value="Mulher">Mulher</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>Essas informações ajudam a Aomenos1km a entender a diversidade dos participantes. Seus dados são anônimos nos relatórios.</p>
                  </div>
                </FField>
              </div>
            </SectionCard>

            {permitirDependentes && !ocultarModalidade && (
              <SectionCard title="Dependentes" icon={<Rocket className="h-5 w-5 text-orange-500" />}>
                <div className="space-y-4">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-3">👨‍👩‍👧‍👦 Deseja inscrever dependentes (menores/familiares)?</p>
                    <p className="text-xs text-blue-700 mb-4">Você pode inscrever filhos, netos, sobrinhos ou cônjuge com um ingresso para cada.</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setTemDependentes(false)}
                        className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                          !temDependentes
                            ? 'bg-blue-600 text-white'
                            : 'border border-blue-300 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        Não, apenas minha inscrição
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemDependentes(true)}
                        className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                          temDependentes
                            ? 'bg-blue-600 text-white'
                            : 'border border-blue-300 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        Sim, quero inscrever
                      </button>
                    </div>
                  </div>

                  {temDependentes && (
                    <div className="space-y-3 border-t pt-4">
                      <div className="rounded-md bg-zinc-50 p-3">
                        <p className="text-xs font-semibold text-zinc-600 mb-2">📋 Total de ingressos: {1 + dependentes.length} / 5</p>
                        <div className="w-full bg-zinc-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${1 + dependentes.length >= 5 ? 'bg-red-500' : (1 + dependentes.length >= 3 ? 'bg-yellow-500' : 'bg-emerald-500')}`}
                            style={{ width: `${((1 + dependentes.length) / 5) * 100}%` } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      {dependentes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-zinc-700">Dependentes adicionados:</p>
                          {dependentes.map((dep, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between rounded-lg border bg-white p-3"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-zinc-800">{dep.nome}</p>
                                <p className="text-xs text-zinc-600">{dep.relacionamento} • Camiseta {dep.tamanho_camiseta}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setDependentes(d => d.filter((_, i) => i !== idx))}
                                className="text-xs font-semibold text-red-600 hover:text-red-700"
                              >
                                Remover
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {mostrandoFormDependente && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                          <p className="text-sm font-semibold text-emerald-900">Adicionar Dependente</p>
                          
                          <FField label="Nome Completo *" id="dep_nome">
                            <Input
                              placeholder="Nome do dependente"
                              value={formDependente.nome}
                              onChange={e => setFormDependente(p => ({ ...p, nome: formatPersonName(e.target.value) }))}
                            />
                          </FField>

                          <FField label="CPF do dependente *" id="dep_cpf">
                            <Input
                              ref={cpfDependenteInputRef}
                              placeholder="000.000.000-00"
                              maxLength={14}
                              value={formDependente.cpf}
                              onChange={e => {
                                setFormDependente(p => ({ ...p, cpf: formatCpf(e.target.value) }))
                                if (cpfDependenteErroEvento) setCpfDependenteErroEvento('')
                              }}
                              onBlur={e => {
                                void validarCpfDependenteComDuplicacao(e.target.value)
                              }}
                              aria-invalid={!!cpfDependenteErro || !!cpfDependenteErroEvento}
                            />
                            {cpfDependenteValidando && <p className="mt-1 text-xs text-muted-foreground">Validando CPF do dependente neste evento...</p>}
                            {cpfDependenteErro && <p className="mt-1 text-xs text-red-600">{cpfDependenteErro}</p>}
                            {!cpfDependenteErro && cpfDependenteErroEvento && <p className="mt-1 text-xs text-red-600">{cpfDependenteErroEvento}</p>}
                          </FField>

                          <FField label="Data de Nascimento *" id="dep_nascimento">
                            <Input
                              type="date"
                              value={formDependente.nascimento}
                              onChange={e => setFormDependente(p => ({ ...p, nascimento: e.target.value }))}
                              max={new Date().toISOString().split('T')[0]}
                            />
                          </FField>

                          <FField label="Relação com você *" id="dep_relacionamento">
                            <Select
                              value={formDependente.relacionamento ?? ''}
                              onValueChange={v => setFormDependente(p => ({ ...p, relacionamento: v || '', conjuge_detalhe: '', conjuge_detalhe_outro: '' }))}
                            >
                              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                              <SelectContent>
                                {RELACIONAMENTOS_DEPENDENTE.map(rel => (
                                  <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FField>

                          {formDependente.relacionamento === 'Cônjuge' && (
                            <>
                              <FField label="Como prefere identificar o cônjuge? *" id="dep_conjuge_detalhe">
                                <Select
                                  value={formDependente.conjuge_detalhe ?? ''}
                                  onValueChange={v => setFormDependente(p => ({ ...p, conjuge_detalhe: v || '', conjuge_detalhe_outro: '' }))}
                                >
                                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                  <SelectContent>
                                    {DETALHES_CONJUGE.map(item => (
                                      <SelectItem key={item} value={item}>{item}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FField>

                              {formDependente.conjuge_detalhe === 'Outro' && (
                                <FField label="Outro (opcional)" id="dep_conjuge_outro">
                                  <Input
                                    placeholder="Ex: Companheiro, Parceira, etc."
                                    value={formDependente.conjuge_detalhe_outro}
                                    onChange={e => setFormDependente(p => ({ ...p, conjuge_detalhe_outro: e.target.value }))}
                                  />
                                </FField>
                              )}
                            </>
                          )}

                          {formDependente.relacionamento === 'Outro responsável' && (
                            <FField label="Qual é sua relação específica? *" id="dep_outro_relacionamento">
                              <Input
                                placeholder="Ex: Padrasto, Prima, Guardião, etc."
                                value={formDependente.relacionamento_especifico}
                                onChange={e => setFormDependente(p => ({ ...p, relacionamento_especifico: e.target.value }))}
                              />
                            </FField>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const nome = formDependente.nome.trim()
                                const cpf = somenteDigitos(formDependente.cpf)
                                const nascimento = formDependente.nascimento
                                const relacionamento = formDependente.relacionamento

                                if (!nome || !cpf || !nascimento || !relacionamento) {
                                  toast.error('Preencha todos os campos obrigatórios')
                                  return
                                }

                                if (cpfDependenteErro) {
                                  toast.error(cpfDependenteErro)
                                  cpfDependenteInputRef.current?.focus()
                                  return
                                }

                                if (cpfDependenteErroEvento) {
                                  toast.error(cpfDependenteErroEvento)
                                  cpfDependenteInputRef.current?.focus()
                                  return
                                }

                                const data = new Date(nascimento)
                                if (Number.isNaN(data.getTime())) {
                                  toast.error('Data de nascimento inválida')
                                  return
                                }

                                if (relacionamento === 'Outro responsável' && !formDependente.relacionamento_especifico.trim()) {
                                  toast.error('Descreva a relação específica')
                                  return
                                }

                                if (relacionamento === 'Cônjuge' && !formDependente.conjuge_detalhe) {
                                  toast.error('Selecione como deseja identificar o cônjuge')
                                  return
                                }

                                try {
                                  const podeAdicionar = await validarCpfDependenteComDuplicacao(formDependente.cpf)
                                  if (!podeAdicionar) {
                                    toast.error(cpfDependenteErroEvento || 'Este CPF já está cadastrado neste evento. Use outro CPF para esta inscrição.')
                                    cpfDependenteInputRef.current?.focus()
                                    return
                                  }
                                } catch {
                                  toast.error('Erro ao validar CPF do dependente')
                                  cpfDependenteInputRef.current?.focus()
                                  return
                                }

                                let relacionamentoFinal = relacionamento
                                if (relacionamento === 'Cônjuge') {
                                  if (formDependente.conjuge_detalhe === 'Outro') {
                                    const outro = formDependente.conjuge_detalhe_outro.trim()
                                    relacionamentoFinal = outro ? `Cônjuge: ${outro}` : 'Cônjuge: Outro'
                                  } else {
                                    relacionamentoFinal = `Cônjuge: ${formDependente.conjuge_detalhe}`
                                  }
                                }

                                setDependentes(deps => [
                                  ...deps,
                                  {
                                    nome,
                                    cpf: formDependente.cpf,
                                    nascimento,
                                    relacionamento: relacionamento === 'Outro responsável'
                                      ? `${relacionamento}: ${formDependente.relacionamento_especifico.trim()}`
                                      : relacionamentoFinal,
                                    tamanho_camiseta: String(form.tamanho_camiseta || CAMISETAS[0]),
                                  },
                                ])

                                setFormDependente({
                                  nome: '',
                                  cpf: '',
                                  nascimento: '',
                                  relacionamento: '',
                                  relacionamento_especifico: '',
                                  conjuge_detalhe: '',
                                  conjuge_detalhe_outro: '',
                                })
                                setCpfDependenteErroEvento('')
                                setMostrandoFormDependente(false)
                                toast.success('Dependente adicionado!')
                              }}
                              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                            >
                              ✓ Adicionar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormDependente({
                                  nome: '',
                                  cpf: '',
                                  nascimento: '',
                                  relacionamento: '',
                                  relacionamento_especifico: '',
                                  conjuge_detalhe: '',
                                  conjuge_detalhe_outro: '',
                                })
                                setCpfDependenteErroEvento('')
                                setMostrandoFormDependente(false)
                              }}
                              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition"
                            >
                              ✕ Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {1 + dependentes.length < 5 && !mostrandoFormDependente && (
                        <button
                          type="button"
                          onClick={() => {
                            setCpfDependenteErroEvento('')
                            setMostrandoFormDependente(true)
                          }}
                          className="w-full rounded-lg border-2 border-dashed border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 transition"
                        >
                          ➕ Adicionar outro dependente
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

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

                  {dependentes.length > 0 && (
                    <div className="rounded-md border border-orange-100 bg-orange-50/50 p-3">
                      <p className="mb-2 text-sm font-semibold text-orange-800">Tamanho das camisetas dos dependentes</p>
                      <div className="space-y-3">
                        {dependentes.map((dep, idx) => (
                          <div key={`${dep.cpf}-${idx}`} className="rounded-md border border-orange-200 bg-white p-2">
                            <p className="mb-2 text-xs font-semibold text-zinc-700">{dep.nome}</p>
                            <div className="grid grid-cols-5 gap-2">
                              {CAMISETAS.map((tamanho, shirtIdx) => (
                                <button
                                  key={`${dep.cpf}-${tamanho}`}
                                  type="button"
                                  ref={el => {
                                    if (!dependenteShirtButtonRefs.current[idx]) {
                                      dependenteShirtButtonRefs.current[idx] = []
                                    }
                                    dependenteShirtButtonRefs.current[idx][shirtIdx] = el
                                  }}
                                  onClick={() => atualizarTamanhoDependente(idx, tamanho)}
                                  onKeyDown={e => handleDependenteShirtKeyDown(e, idx, shirtIdx)}
                                  tabIndex={dep.tamanho_camiseta === tamanho ? 0 : -1}
                                  className={`rounded-lg border px-2 py-1 text-xs font-bold transition ${dep.tamanho_camiseta === tamanho ? 'border-orange-500 bg-orange-500 text-white shadow' : 'border-zinc-300 bg-white text-zinc-600 hover:border-orange-400 hover:text-orange-600'}`}
                                >
                                  {tamanho}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

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

            {ehEventoPago && (
              <SectionCard title="Pagamento da Inscrição" icon={<Ticket className="h-5 w-5 text-orange-500" />}>
                <div className="rounded-lg border-2 border-dashed border-orange-400 bg-zinc-50 p-4 text-center">
                  <span className="inline-flex rounded-full bg-orange-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    Taxa de Participação
                  </span>
                  <p className="mt-3 text-lg font-semibold text-zinc-600">Valor total da inscrição:</p>
                  <div className="mt-2 inline-flex rounded-xl bg-orange-500 px-6 py-2 text-5xl font-black text-white shadow">
                    {valorInscricaoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {valorInscricao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por ingresso x {totalIngressosSelecionados} ingresso(s)
                  </p>
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
