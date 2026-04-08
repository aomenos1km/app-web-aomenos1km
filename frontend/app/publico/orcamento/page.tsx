'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Building2, User, Search, Send, MapPin, PackageOpen, Users, Check, Crown, X } from 'lucide-react'
import { configuracoes, orcamentos, type ConfiguracaoPublicaPreco } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type TipoPessoa = 'pj' | 'pf'
type TipoPacote = 'padrao' | 'personalizado'

type LocalPublico = {
  id: string
  nome: string
  cidade?: string
  uf?: string
  capacidade_maxima?: number | null
}

const FALLBACK_CONFIG: ConfiguracaoPublicaPreco = {
  margem_lucro: 75,
  custo_operacional_fixo: 5,
  adicional_kit_premium: 40,
  preco_backup_camiseta: 25,
  preco_backup_medalha: 15,
  preco_backup_squeeze: 10,
  preco_backup_bag: 12,
  preco_backup_lanche: 15,
  preco_backup_trofeu: 45,
  setup_minimo: 1200,
  limite_setup_pessoas: 150,
  preco_base_por_pessoa: 143.5,
}

const ITENS_KIT_PADRAO = ['Camiseta Tech', 'Medalha + Squeeze', 'Bag Esportiva', 'Kit Snacks']
const PARTICULAS_NOME = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e'])

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function formatCNPJ(value: string) {
  const d = onlyDigits(value).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatCPF(value: string) {
  const d = onlyDigits(value).slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function formatCEP(value: string) {
  const d = onlyDigits(value).slice(0, 8)
  return d.replace(/(\d{5})(\d)/, '$1-$2')
}

function formatPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11)
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2')
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

function isValidCPF(value: string) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cpf[i]) * (10 - i)
  }
  let digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  if (digit !== Number(cpf[9])) return false

  sum = 0
  for (let i = 0; i < 10; i += 1) {
    sum += Number(cpf[i]) * (11 - i)
  }
  digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  return digit === Number(cpf[10])
}

function isValidCNPJ(value: string) {
  const cnpj = onlyDigits(value)
  if (cnpj.length !== 14) return false
  if (/^(\d)\1+$/.test(cnpj)) return false

  const calc = (base: string, factors: number[]) => {
    const total = base
      .split('')
      .reduce((acc, cur, idx) => acc + Number(cur) * factors[idx], 0)
    const rest = total % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const first = calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = calc(cnpj.slice(0, 12) + String(first), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])

  return first === Number(cnpj[12]) && second === Number(cnpj[13])
}

export default function OrcamentoPublicoPage() {
  const kmInputRef = useRef<HTMLInputElement>(null)
  const pacotePadraoRef = useRef<HTMLButtonElement>(null)
  const pacotePersonalizadoRef = useRef<HTMLButtonElement>(null)
  const qtdPessoasRef = useRef<HTMLInputElement>(null)
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>('pj')
  const [tipoPacote, setTipoPacote] = useState<TipoPacote>('padrao')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [modalLocalOpen, setModalLocalOpen] = useState(false)
  const [buscaLocal, setBuscaLocal] = useState('')
  const [localAtivoIndex, setLocalAtivoIndex] = useState(0)
  const [consultores, setConsultores] = useState<string[]>([])
  const [locais, setLocais] = useState<LocalPublico[]>([])
  const [precoConfig, setPrecoConfig] = useState<ConfiguracaoPublicaPreco>(FALLBACK_CONFIG)
  const [whiteLabel, setWhiteLabel] = useState(false)
  const [errors, setErrors] = useState<{ cpf?: string; cnpj?: string; data_interesse?: string; qtd_participantes?: string }>({})

  const [form, setForm] = useState({
    cnpj: '',
    cpf: '',
    empresa_nome: '',
    nome_pf: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    consultor: '',
    responsavel: '',
    telefone: '',
    email: '',
    data_interesse: '',
    local_nome: '',
    km: '',
    qtd_participantes: 30,
    modalidade: 'Corrida',
    possui_kit: true,
  })

  const hoje = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetch(`${API_BASE}/api/consultores/publico`)
      .then(r => r.json())
      .then(r => {
        if (r?.success && Array.isArray(r.data) && r.data.length > 0) {
          setConsultores(r.data)
        }
      })
      .catch(() => undefined)

    fetch(`${API_BASE}/api/locais/publico`)
      .then(r => r.json())
      .then(r => {
        if (r?.success && Array.isArray(r.data)) {
          setLocais(r.data)
        }
      })
      .catch(() => undefined)

    configuracoes
      .buscarPrecoPublico()
      .then(r => {
        if (r?.success && r.data) {
          setPrecoConfig(r.data)
        }
      })
      .catch(() => undefined)
  }, [])

  const locaisFiltrados = useMemo(() => {
    const term = buscaLocal.trim().toLowerCase()
    if (!term) return locais
    return locais.filter(l => `${l.nome} ${l.cidade || ''} ${l.uf || ''}`.toLowerCase().includes(term))
  }, [locais, buscaLocal])

  useEffect(() => {
    if (!modalLocalOpen) return
    if (locaisFiltrados.length === 0) {
      setLocalAtivoIndex(0)
      return
    }

    const atual = form.local_nome
      ? locaisFiltrados.findIndex(l => l.nome === form.local_nome)
      : -1

    if (atual >= 0) {
      setLocalAtivoIndex(atual)
      return
    }

    setLocalAtivoIndex(0)
  }, [modalLocalOpen, locaisFiltrados, form.local_nome])

  useEffect(() => {
    if (!modalLocalOpen || locaisFiltrados.length === 0) return
    const el = document.getElementById(`local-option-${locaisFiltrados[localAtivoIndex]?.id}`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [modalLocalOpen, localAtivoIndex, locaisFiltrados])

  useEffect(() => {
    if (!modalLocalOpen || locaisFiltrados.length === 0) return
    const timer = setTimeout(() => {
      const first = document.getElementById(`local-option-${locaisFiltrados[localAtivoIndex]?.id}`) as HTMLButtonElement | null
      first?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [modalLocalOpen])

  const precoUnitario = useMemo(() => {
    return precoConfig.preco_base_por_pessoa + (whiteLabel ? precoConfig.adicional_kit_premium : 0)
  }, [precoConfig, whiteLabel])

  const totalEstimado = useMemo(() => {
    const qtdInformada = Number(form.qtd_participantes || 0)
    const qtd = Math.max(30, qtdInformada)
    const total = qtd * precoUnitario
    if (qtd < precoConfig.limite_setup_pessoas) {
      return Math.max(total, precoConfig.setup_minimo)
    }
    return total
  }, [form.qtd_participantes, precoUnitario, precoConfig])

  const localSelecionado = useMemo(() => locais.find(l => l.nome === form.local_nome), [locais, form.local_nome])

  function selecionarLocal(local: LocalPublico) {
    setForm(p => ({ ...p, local_nome: local.nome }))
    setModalLocalOpen(false)
    setTimeout(() => kmInputRef.current?.focus(), 0)
  }

  function selecionarPacotePadrao(focarCard = false) {
    setTipoPacote('padrao')
    setForm(p => ({ ...p, qtd_participantes: 30 }))
    setErrors(prev => ({ ...prev, qtd_participantes: undefined }))
    if (focarCard) {
      setTimeout(() => pacotePadraoRef.current?.focus(), 0)
    }
  }

  function selecionarPacotePersonalizado(focarQuantidade = false) {
    setTipoPacote('personalizado')
    if (focarQuantidade) {
      setTimeout(() => qtdPessoasRef.current?.focus(), 0)
    }
  }

  function onPacoteKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      selecionarPacotePersonalizado(true)
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      selecionarPacotePadrao(true)
    }
  }

  function onLocalModalKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!modalLocalOpen || locaisFiltrados.length === 0) return

    const cols = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches ? 2 : 1
    const moveAtivo = (delta: number, wrap = true) => {
      const total = locaisFiltrados.length
      const nextRaw = localAtivoIndex + delta
      const next = wrap
        ? (nextRaw + total) % total
        : Math.max(0, Math.min(total - 1, nextRaw))
      setLocalAtivoIndex(next)
      const target = document.getElementById(`local-option-${locaisFiltrados[next]?.id}`) as HTMLButtonElement | null
      target?.focus()
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveAtivo(cols)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveAtivo(-cols)
      return
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      moveAtivo(1)
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      moveAtivo(-1)
      return
    }

    if (e.key === 'Home') {
      e.preventDefault()
      moveAtivo(-locaisFiltrados.length, false)
      return
    }

    if (e.key === 'End') {
      e.preventDefault()
      moveAtivo(locaisFiltrados.length, false)
      return
    }

    if (e.key === 'PageDown') {
      e.preventDefault()
      moveAtivo(cols * 3, false)
      return
    }

    if (e.key === 'PageUp') {
      e.preventDefault()
      moveAtivo(-(cols * 3), false)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const alvo = locaisFiltrados[localAtivoIndex]
      if (alvo) selecionarLocal(alvo)
    }
  }

  async function buscarCNPJ() {
    const cnpj = onlyDigits(form.cnpj)
    if (cnpj.length !== 14) {
      setErrors(prev => ({ ...prev, cnpj: 'Informe um CNPJ com 14 digitos.' }))
      return
    }

    if (!isValidCNPJ(cnpj)) {
      setErrors(prev => ({ ...prev, cnpj: 'CNPJ invalido.' }))
      return
    }

    setErrors(prev => ({ ...prev, cnpj: undefined }))

    try {
      const res = await fetch(`${API_BASE}/api/empresas/consulta-cnpj-publico?cnpj=${encodeURIComponent(cnpj)}`)
      const body = await res.json()
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || 'Falha ao consultar CNPJ')
      }

      const d = body.data || {}
      const telefoneBruto = (d.telefone || '').replace(/\D/g, '')
      setForm(prev => ({
        ...prev,
        empresa_nome: d.nome || prev.empresa_nome,
        email: prev.email || String(d.email || '').toLowerCase() || '',
        telefone: prev.telefone || (telefoneBruto ? formatPhone(telefoneBruto) : ''),
        logradouro: d.logradouro || prev.logradouro,
        numero: d.numero || prev.numero,
        bairro: d.bairro || prev.bairro,
        cidade: d.municipio || prev.cidade,
        uf: d.uf || prev.uf,
        cep: d.cep ? formatCEP(d.cep) : prev.cep,
      }))
      toast.success('Dados do CNPJ carregados')
    } catch {
      toast.error('Não foi possível buscar os dados do CNPJ automaticamente. Preencha a Razão Social manualmente.')
    }
  }

  async function buscarCEP(value: string) {
    const cep = onlyDigits(value)
    if (cep.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (data?.erro) return
      setForm(prev => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
      }))
    } catch {
      // ignora falha eventual do servico externo
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const qtdInformada = Number(form.qtd_participantes || 0)
    const qtd = Math.max(30, qtdInformada)
    if (!form.responsavel || !form.telefone || !form.email) {
      toast.error('Preencha nome, WhatsApp e e-mail')
      return
    }
    if (!form.consultor) {
      toast.error('Selecione o Consultor(a) de Atendimento')
      return
    }

    if (tipoPessoa === 'pj' && !form.empresa_nome) {
      toast.error('Preencha a razao social da empresa')
      return
    }

    if (tipoPessoa === 'pf' && !form.nome_pf) {
      toast.error('Preencha o nome completo da pessoa fisica')
      return
    }

    if (qtdInformada < 30) {
      setErrors(prev => ({ ...prev, qtd_participantes: 'A quantidade deve ser de, no mínimo, 30 pessoas.' }))
      toast.error('A quantidade deve ser de, no mínimo, 30 pessoas.')
      return
    }
    setErrors(prev => ({ ...prev, qtd_participantes: undefined }))

    if (tipoPessoa === 'pf') {
      if (!onlyDigits(form.cpf)) {
        setErrors(prev => ({ ...prev, cpf: 'Informe o CPF.' }))
        return
      }
      if (!isValidCPF(form.cpf)) {
        setErrors(prev => ({ ...prev, cpf: 'CPF invalido.' }))
        return
      }
      setErrors(prev => ({ ...prev, cpf: undefined }))
    }

    if (tipoPessoa === 'pj') {
      if (!onlyDigits(form.cnpj)) {
        setErrors(prev => ({ ...prev, cnpj: 'Informe o CNPJ.' }))
        return
      }
      if (!isValidCNPJ(form.cnpj)) {
        setErrors(prev => ({ ...prev, cnpj: 'CNPJ invalido.' }))
        return
      }
      setErrors(prev => ({ ...prev, cnpj: undefined }))
    }

    if (form.data_interesse && form.data_interesse < hoje) {
      setErrors(prev => ({ ...prev, data_interesse: 'A data prevista nao pode ser no passado.' }))
      return
    }
    setErrors(prev => ({ ...prev, data_interesse: undefined }))

    setEnviando(true)
    try {
      const empresaNome = tipoPessoa === 'pj' ? form.empresa_nome : form.nome_pf
      const mensagem = [
        '[origem:site] Pedido do formulario publico',
        `Endereco: ${form.logradouro}, ${form.numero} ${form.complemento}`.trim(),
        `Bairro: ${form.bairro}`,
        `Cidade/UF: ${form.cidade}/${form.uf}`,
      ].join(' | ')

      await orcamentos.enviarPublico({
        empresa_nome: empresaNome,
        responsavel: form.responsavel,
        email: form.email,
        telefone: form.telefone,
        valor_estimado: totalEstimado,
        cep: form.cep,
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        data_interesse: form.data_interesse || null,
        modalidade: form.modalidade,
        qtd_participantes: qtd,
        km: form.km || '0',
        possui_kit: form.possui_kit,
        mensagem,
        consultor: form.consultor,
        tipo_pessoa: tipoPessoa,
        cnpj: tipoPessoa === 'pj' ? form.cnpj : '',
        cpf: tipoPessoa === 'pf' ? form.cpf : '',
        local_nome: form.local_nome,
      })
      setSucesso(true)
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao enviar solicitação')
    } finally {
      setEnviando(false)
    }
  }

  if (sucesso) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-[#f5f5f7]">
        <Card className="w-full max-w-md text-center border-0 shadow-md overflow-hidden">
          <div className="border-b-4 border-b-[#f25c05] bg-white py-6 space-y-3">
            <div className="flex justify-center">
              <img src="/logo-aomenos1km.png" alt="Aomenos1km" className="h-20" />
            </div>
            <p className="text-lg font-bold text-slate-800">Solicitação de Orçamento</p>
          </div>
          <CardContent className="pt-8 pb-8 space-y-5">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Solicitação enviada com sucesso!</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Obrigado pelo interesse! Nossa equipe vai analisar sua solicitação e entrar em contato em breve pelo WhatsApp ou e-mail informado.
              </p>
            </div>
            <div className="border-t pt-5 space-y-3">
              <p className="text-sm font-medium text-slate-600">Aproveite e acompanhe a gente nas redes:</p>
              <a
                href="https://www.instagram.com/aomenos1km"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                @aomenos1km
              </a>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f2f3f5] py-6 px-3">
      <div className="max-w-3xl mx-auto rounded-xl overflow-hidden border bg-white shadow-sm">
        <div className="border-b-4 border-b-[#f25c05] bg-white py-6 text-center space-y-3">
          <div className="flex justify-center">
            <img src="/logo-aomenos1km.png" alt="Aomenos1km" className="h-24" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Solicitação de Orçamento</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-8 space-y-6">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">1. Seus Dados</h2>

            <div className="grid grid-cols-2 rounded-md border p-1 bg-slate-50 gap-1">
              <button
                type="button"
                onClick={() => {
                  setTipoPessoa('pj')
                  setErrors(prev => ({ ...prev, cpf: undefined }))
                }}
                className={`h-10 rounded text-sm font-semibold ${tipoPessoa === 'pj' ? 'bg-[#f25c05] text-white' : 'text-slate-600'}`}
              >
                <Building2 className="inline h-4 w-4 mr-1" /> Empresa (CNPJ)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoPessoa('pf')
                  setErrors(prev => ({ ...prev, cnpj: undefined }))
                }}
                className={`h-10 rounded text-sm font-semibold ${tipoPessoa === 'pf' ? 'bg-[#f25c05] text-white' : 'text-slate-600'}`}
              >
                <User className="inline h-4 w-4 mr-1" /> Pessoa Fisica (CPF)
              </button>
            </div>

            {tipoPessoa === 'pj' ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <Field label="CNPJ" className="md:col-span-4" error={errors.cnpj}>
                  <div className="flex gap-2">
                    <Input
                      value={form.cnpj}
                      onChange={e => {
                        const next = formatCNPJ(e.target.value)
                        setForm(p => ({ ...p, cnpj: next }))
                        if (!next) {
                          setErrors(prev => ({ ...prev, cnpj: undefined }))
                          return
                        }
                        const digits = onlyDigits(next)
                        if (digits.length === 14) {
                          setErrors(prev => ({ ...prev, cnpj: isValidCNPJ(next) ? undefined : 'CNPJ invalido.' }))
                        } else {
                          setErrors(prev => ({ ...prev, cnpj: undefined }))
                        }
                      }}
                      placeholder="00.000.000/0000-00"
                    />
                    <Button type="button" variant="outline" onClick={buscarCNPJ}><Search className="h-4 w-4" /></Button>
                  </div>
                </Field>
                <Field label="Razao Social" className="md:col-span-8">
                  <Input value={form.empresa_nome} onChange={e => setForm(p => ({ ...p, empresa_nome: e.target.value }))} />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <Field label="CPF" className="md:col-span-4" error={errors.cpf}>
                  <Input
                    value={form.cpf}
                    onChange={e => {
                      const next = formatCPF(e.target.value)
                      setForm(p => ({ ...p, cpf: next }))
                      if (!next) {
                        setErrors(prev => ({ ...prev, cpf: undefined }))
                        return
                      }
                      const digits = onlyDigits(next)
                      if (digits.length === 11) {
                        setErrors(prev => ({ ...prev, cpf: isValidCPF(next) ? undefined : 'CPF invalido.' }))
                      } else {
                        setErrors(prev => ({ ...prev, cpf: undefined }))
                      }
                    }}
                    placeholder="000.000.000-00"
                  />
                </Field>
                <Field label="Nome Completo" className="md:col-span-8">
                  <Input value={form.nome_pf} onChange={e => setForm(p => ({ ...p, nome_pf: formatPersonName(e.target.value) }))} autoCapitalize="words" />
                </Field>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <Field label="CEP" className="md:col-span-3">
                <Input value={form.cep} onChange={e => setForm(p => ({ ...p, cep: formatCEP(e.target.value) }))} onBlur={e => void buscarCEP(e.target.value)} placeholder="00000-000" />
              </Field>
              <Field label="Logradouro" className="md:col-span-6">
                <Input value={form.logradouro} onChange={e => setForm(p => ({ ...p, logradouro: e.target.value }))} />
              </Field>
              <Field label="Numero" className="md:col-span-3">
                <Input value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} />
              </Field>
              <Field label="Complemento" className="md:col-span-4">
                <Input value={form.complemento} onChange={e => setForm(p => ({ ...p, complemento: e.target.value }))} />
              </Field>
              <Field label="Bairro" className="md:col-span-4">
                <Input value={form.bairro} onChange={e => setForm(p => ({ ...p, bairro: e.target.value }))} />
              </Field>
              <Field label="Cidade" className="md:col-span-3">
                <Input value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} />
              </Field>
              <Field label="UF" className="md:col-span-1">
                <Input value={form.uf} onChange={e => setForm(p => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))} />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Consultor(a) de Atendimento">
                <Select value={form.consultor || ''} onValueChange={(v: string | null) => setForm(p => ({ ...p, consultor: v ?? '' }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um consultor" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                    {consultores.map(nome => <SelectItem value={nome} key={nome}>{nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nome do Solicitante">
                <Input value={form.responsavel} onChange={e => setForm(p => ({ ...p, responsavel: formatPersonName(e.target.value) }))} placeholder="Quem esta pedindo o orcamento?" autoCapitalize="words" />
              </Field>
              <Field label="WhatsApp">
                <Input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: formatPhone(e.target.value) }))} />
              </Field>
              <Field label="E-mail">
                <Input value={form.email} type="email" onChange={e => setForm(p => ({ ...p, email: e.target.value.toLowerCase().trimStart() }))} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              </Field>
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <h2 className="text-lg font-semibold">2. Detalhes do Evento</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Data Prevista" error={errors.data_interesse}>
                <Input
                  type="date"
                  min={hoje}
                  value={form.data_interesse}
                  onChange={e => {
                    const next = e.target.value
                    if (next && next < hoje) {
                      setForm(p => ({ ...p, data_interesse: next }))
                      setErrors(prev => ({ ...prev, data_interesse: 'A data prevista nao pode ser no passado.' }))
                      return
                    }
                    setErrors(prev => ({ ...prev, data_interesse: undefined }))
                    setForm(p => ({ ...p, data_interesse: next }))
                  }}
                />
              </Field>
              <Field label="Local do Evento">
                <button
                  type="button"
                  onClick={() => setModalLocalOpen(true)}
                  className="w-full h-9 flex items-center justify-between rounded-lg border border-input px-3 text-sm bg-white hover:bg-slate-50"
                >
                  <span className={form.local_nome ? 'text-foreground' : 'text-muted-foreground'}>
                    {form.local_nome || 'Selecione um local'}
                  </span>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </button>
              </Field>
              <Field label="Distancia Prevista (KM)">
                <Input 
                  ref={kmInputRef}
                  value={form.km} 
                  onChange={e => setForm(p => ({ ...p, km: e.target.value }))} 
                  placeholder="Ex: 5, 10 ou 21" 
                />
              </Field>
              <Field label="Modalidade">
                <Select value={form.modalidade} onValueChange={(v: string | null) => setForm(p => ({ ...p, modalidade: v ?? 'A definir' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corrida">Corrida</SelectItem>
                    <SelectItem value="Caminhada">Caminhada</SelectItem>
                    <SelectItem value="Mista">Mista</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <h2 className="text-lg font-semibold">3. Escolha o Pacote</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                ref={pacotePadraoRef}
                type="button"
                onClick={() => selecionarPacotePadrao(false)}
                onKeyDown={onPacoteKeyDown}
                className={`relative text-left rounded-xl border-2 p-5 transition-colors ${tipoPacote === 'padrao' ? 'border-[#f25c05] bg-orange-50/35' : 'border-slate-200 bg-white'}`}
              >
                {tipoPacote === 'padrao' && <Check className="absolute right-4 top-4 h-4 w-4 text-[#f25c05]" />}
                <div className="text-center">
                  <PackageOpen className="h-7 w-7 mx-auto text-[#f25c05] mb-2" />
                  <h3 className="font-bold text-[30px] leading-tight">Kit aomenos1km</h3>
                  <span className="inline-flex text-[11px] px-2 py-0.5 rounded bg-slate-600 text-white font-semibold">Ideal para começar</span>
                  <p className="text-5xl font-extrabold mt-2 text-slate-900">30 Pessoas</p>
                  <p className="text-slate-500">{moeda(precoUnitario)} / pessoa</p>
                </div>
                <div className="mt-3 border-t pt-3 space-y-1 text-sm text-slate-600">
                  {ITENS_KIT_PADRAO.map(item => (
                    <p key={item} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> {item}</p>
                  ))}
                </div>
              </button>

              <button
                ref={pacotePersonalizadoRef}
                type="button"
                onClick={() => selecionarPacotePersonalizado(true)}
                onKeyDown={onPacoteKeyDown}
                className={`text-left rounded-xl border p-5 transition-colors ${tipoPacote === 'personalizado' ? 'border-[#f25c05] bg-orange-50/20' : 'border-slate-200 bg-white'}`}
              >
                <div className="text-center">
                  <Users className="h-7 w-7 mx-auto text-[#f25c05] mb-2" />
                  <h3 className="font-bold text-3xl">Definir Quantidade</h3>
                  <span className="inline-flex text-[11px] px-2 py-0.5 rounded bg-slate-800 text-white font-semibold">Para outros grupos</span>
                  <div className="mt-3 inline-flex overflow-hidden border rounded-lg">
                    <Input
                      ref={qtdPessoasRef}
                      type="number"
                      min={0}
                      className="w-24 h-10 border-0 rounded-none text-center font-bold"
                      value={form.qtd_participantes}
                      onFocus={() => setTipoPacote('personalizado')}
                      onKeyDown={onPacoteKeyDown}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '')
                        const v = raw === '' ? 0 : Number(raw)
                        setForm(p => ({ ...p, qtd_participantes: v }))
                        if (v > 0 && v < 30) {
                          setErrors(prev => ({ ...prev, qtd_participantes: 'A quantidade deve ser de, no mínimo, 30 pessoas.' }))
                        } else {
                          setErrors(prev => ({ ...prev, qtd_participantes: undefined }))
                        }
                      }}
                    />
                    <span className="h-10 px-4 inline-flex items-center bg-slate-50 text-slate-700">Pessoas</span>
                  </div>
                  {errors.qtd_participantes && (
                    <p className="mt-2 text-xs text-red-600">{errors.qtd_participantes}</p>
                  )}
                  <p className="mt-2 text-slate-500">{moeda(precoUnitario)} / pessoa</p>
                </div>
                <div className="mt-3 border-t pt-3 space-y-1 text-sm text-slate-600">
                  {ITENS_KIT_PADRAO.map(item => (
                    <p key={item} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> {item}</p>
                  ))}
                </div>
              </button>
            </div>

            <div className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${whiteLabel ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setWhiteLabel(v => !v)}
                  className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${whiteLabel ? 'bg-[#f25c05]' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white mt-0.5 transition-transform ${whiteLabel ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <p className="font-bold flex items-center gap-1"><Crown className="h-4 w-4 text-yellow-400" /> Personalizar com MINHA MARCA</p>
                  <p className={`text-sm ${whiteLabel ? 'text-slate-200' : 'text-slate-600'}`}>Adiciona sua logo na camiseta e squeeze (+ {moeda(precoConfig.adicional_kit_premium)}/pessoa)</p>
                </div>
              </div>
              <span className="text-xs font-bold rounded px-2 py-1 bg-yellow-400 text-slate-900">White Label</span>
            </div>

            <div className="rounded-lg bg-slate-900 text-amber-400 text-center py-4">
              <p className="text-xs uppercase font-bold">Investimento total estimado</p>
              <p className="text-4xl font-extrabold">{moeda(totalEstimado)}</p>
            </div>
            {Number(form.qtd_participantes || 0) < precoConfig.limite_setup_pessoas && totalEstimado === precoConfig.setup_minimo && (
              <p className="text-xs text-muted-foreground">
                Total respeita setup minimo de {moeda(precoConfig.setup_minimo)} para grupos abaixo de {precoConfig.limite_setup_pessoas} pessoas.
              </p>
            )}
          </section>

          <Button type="submit" disabled={enviando} className="w-full h-12 bg-[#f25c05] hover:bg-[#d84f00] text-white text-base font-bold">
            <Send className="h-4 w-4 mr-2" />
            {enviando ? 'Enviando...' : 'Solicitar Orcamento Agora'}
          </Button>
        </form>
      </div>

      <Dialog open={modalLocalOpen} onOpenChange={setModalLocalOpen}>
        <DialogContent className="max-w-3xl" onKeyDown={onLocalModalKeyDown}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Selecionar Local do Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome, cidade ou tipo..."
                value={buscaLocal}
                onChange={e => setBuscaLocal(e.target.value)}
              />
            </div>

            {locaisFiltrados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum local encontrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
                {locaisFiltrados.map(l => (
                  <button
                    key={l.id}
                    id={`local-option-${l.id}`}
                    type="button"
                    onClick={() => selecionarLocal(l)}
                    onMouseEnter={() => {
                      const idx = locaisFiltrados.findIndex(item => item.id === l.id)
                      if (idx >= 0) setLocalAtivoIndex(idx)
                    }}
                    onFocus={() => {
                      const idx = locaisFiltrados.findIndex(item => item.id === l.id)
                      if (idx >= 0) setLocalAtivoIndex(idx)
                    }}
                    className={`text-left rounded-lg border p-3 hover:bg-muted/40 transition-colors ${localAtivoIndex >= 0 && locaisFiltrados[localAtivoIndex]?.id === l.id ? 'border-primary bg-primary/5' : form.local_nome === l.nome ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <p className="font-semibold text-sm">{l.nome}</p>
                    <p className="text-xs text-muted-foreground">{l.cidade || ''}{l.uf ? ` - ${l.uf}` : ''}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Capacidade maxima: {l.capacidade_maxima ? l.capacidade_maxima : 'Nao informada'} pessoas
                    </p>
                  </button>
                ))}
              </div>
            )}

            {form.local_nome && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm(p => ({ ...p, local_nome: '' }))}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Limpar local selecionado
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function Field({
  label,
  className = '',
  error,
  children,
}: {
  label: string
  className?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
