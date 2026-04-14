'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  configuracoes,
  empresas,
  Empresa,
  insumos,
  Insumo,
  locais,
  Local,
  orcamentos,
  OrcamentoPendente,
  perfisOrcamento,
  PerfilOrcamento,
  RegraOrcamento,
  ItemCalculado,
  Proposta,
  PropostaDetalhe,
} from '@/lib/api'
import { abrirPreviewProposta, PropostaPdfData } from '@/lib/proposta-pdf'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  RTable,
  RTableBody,
  RTableCell,
  RTableHead,
  RTableHeader,
  RTableRow,
} from '@/components/ui/responsive-table'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Bot,
  Building2,
  Calculator,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileCheck2,
  FileText,
  ImageIcon,
  MapPin,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  Copy,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  buildComercialTag,
  buildCondicoesTag,
  buildCondicoesFromComercial,
  COMERCIAL_DEFAULTS,
  parseCondicoesTag,
  parseComercialTag,
  stripComercialTag,
  stripCondicoesTag,
  type ComercialEstruturado,
} from '@/lib/proposta-comercial'

const TERMOS_PADRAO = `1. ALTERAÇÃO DE QUANTIDADE:
O número de participantes/kits pode ser ajustado em até 10% sem custo extra até 15 dias antes do evento. Após essa data, será cobrado o valor integral contratado.

2. POLÍTICA DE CANCELAMENTO:
Em caso de cancelamento por parte do cliente com menos de 7 dias de antecedência, será retido 50% do valor total para cobrir custos operacionais já realizados.

3. LOGÍSTICA E ENTREGA:
A montagem da estrutura e entrega dos kits será realizada no local indicado. É de responsabilidade do cliente fornecer autorização de entrada para a equipe e veículos.

4. INFORMAÇÕES ADICIONAIS:
Não estão inclusos custos de estacionamento ou taxas extras do local, salvo se especificado nos itens acima.`

// ������ Tipos locais ��������������������������������������������������������������������������������������������������������������������������

type OrcamentoItem = {
  id: string
  insumoId: string
  nome: string
  descricao: string
  qtd: number
  valorUnit: number
  categoria: string
}

const EMPTY_ITEM: OrcamentoItem = {
  id: crypto.randomUUID(),
  insumoId: '',
  nome: '',
  descricao: '',
  qtd: 1,
  valorUnit: 0,
  categoria: '',
}

const PARTICULAS_NOME = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e'])

function isAutoLocalItem(item: OrcamentoItem) {
  if (item.insumoId) return false
  return item.nome === 'Infraestrutura e Log\u00edstica' || item.nome === 'Registro Retroativo Consolidado'
}

// ������ Helpers ������������������������������������������������������������������������������������������������������������������������������������

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function parseNumber(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusBadgeClass(status?: string) {
  switch (status) {
    case 'Finalizada':  return 'border-blue-300 bg-blue-50 text-blue-700'
    case 'Enviada':     return 'border-orange-300 bg-orange-50 text-orange-700'
    case 'Convertida':  return 'border-emerald-300 bg-emerald-50 text-emerald-700'
    default:            return 'border-slate-300 bg-slate-50 text-slate-600'
  }
}

function isPropostaRetroativa(observacoes?: string) {
  return String(observacoes || '').toLowerCase().includes('[origem:retroativo]')
}

function parseRetroValorPago(observacoes?: string) {
  const texto = String(observacoes || '')
  const match = texto.match(/\[retroativo:valor_pago=([0-9]+(?:\.[0-9]+)?)\]/i)
  if (!match) return 0
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrencyInput(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function computeTaxaLocal(
  localSelecionado: Local | undefined,
  qtdPessoas: number,
  setupMinimo: number,
  limiteSetupPessoas: number,
) {
  if (!localSelecionado) return 0
  if (qtdPessoas <= limiteSetupPessoas) {
    return Math.max(Number(setupMinimo || 0), 0)
  }
  if (localSelecionado.tipo_taxa === 'Pessoa') {
    return Number(localSelecionado.taxa_valor ?? 0) * Math.max(qtdPessoas, 0)
  }
  return Number(localSelecionado.taxa_valor ?? 0)
}

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    .replace(/(\d{2})(\d{3})(\d{3})(\d{4})$/, '$1.$2.$3/$4')
    .replace(/(\d{2})(\d{3})(\d{3})$/, '$1.$2.$3')
    .replace(/(\d{2})(\d{3})$/, '$1.$2')
}

function maskCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function formatPhone(value: string) {
  const digits = digitsOnly(value).slice(0, 11)

  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }

  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
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

function formatEventName(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^ /, '')
    .split(' ')
    .map((word, index) => {
      if (!word) return word
      if (/\d/.test(word)) {
        return word.replace(/[a-z]/g, char => char.toUpperCase())
      }

      const lower = word.toLowerCase()
      if (index > 0 && PARTICULAS_NOME.has(lower)) return lower

      return lower
        .split("'")
        .map(part => part.split('-').map(capitalizeNameSegment).join('-'))
        .join("'")
    })
    .join(' ')
}

function isValidCPF(value: string) {
  const cpf = digitsOnly(value)
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
  const cnpj = digitsOnly(value)
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

// ������ Componente principal ��������������������������������������������������������������������������������������������������������

export default function OrcamentosPage() {
  const { user } = useAuth()
  // Catálogos
  const [loadingCatalogos, setLoadingCatalogos] = useState(true)
  const [empresasList, setEmpresasList] = useState<Empresa[]>([])
  const [locaisList, setLocaisList] = useState<Local[]>([])
  const [insumosList, setInsumosList] = useState<Insumo[]>([])
  const [pedidosList, setPedidosList] = useState<OrcamentoPendente[]>([])
  const [propostasRecentes, setPropostasRecentes] = useState<Proposta[]>([])
  const [propostasQ, setPropostasQ] = useState('')
  const [propostaAtualId, setPropostaAtualId] = useState('')

  // Perfis
  const [perfis, setPerfis] = useState<PerfilOrcamento[]>([])

  // Campos do gerador
  const [pedidoId, setPedidoId] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [localId, setLocalId] = useState('')
  const [eventoNome, setEventoNome] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [horaChegada, setHoraChegada] = useState('')
  const [qtdPessoas, setQtdPessoas] = useState(0)
  const [kmEvento, setKmEvento] = useState(0)
  const [responsavel, setResponsavel] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cidadeEvento, setCidadeEvento] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [margemGlobal, setMargemGlobal] = useState(0)
  const [modoPreco, setModoPreco] = useState<'margem' | 'porPessoa'>('margem')
  const [precoAlvoPessoa, setPrecoAlvoPessoa] = useState(0)
  const [sincronizarQtd, setSincronizarQtd] = useState(false)
  const [items, setItems] = useState<OrcamentoItem[]>([{ ...EMPTY_ITEM, id: crypto.randomUUID() }])
  const [savingProposta, setSavingProposta] = useState(false)
  const [cadastroRetroativo, setCadastroRetroativo] = useState(false)
  const [retroDetalharEscopo, setRetroDetalharEscopo] = useState(false)
  const [retroValorTotal, setRetroValorTotal] = useState('')
  const [retroValorPago, setRetroValorPago] = useState('')

  // Accordion "Novo Cliente"
  const [showNovoCliente, setShowNovoCliente] = useState(false)
  const [tipoPessoa, setTipoPessoa] = useState<'PJ' | 'PF'>('PJ')
  const [ncDocumento, setNcDocumento] = useState('')
  const [ncDocumentoError, setNcDocumentoError] = useState('')
  const [ncRazaoSocial, setNcRazaoSocial] = useState('')
  const [ncNomeFantasia, setNcNomeFantasia] = useState('')
  const [ncResponsavel, setNcResponsavel] = useState('')
  const [ncTelefone, setNcTelefone] = useState('')
  const [ncEmail, setNcEmail] = useState('')
  const [ncCidade, setNcCidade] = useState('')
  const [ncUF, setNcUF] = useState('')
  const [ncCEP, setNcCEP] = useState('')
  const [ncLogradouro, setNcLogradouro] = useState('')
  const [ncNumero, setNcNumero] = useState('')
  const [savingCliente, setSavingCliente] = useState(false)
  const [consultandoCNPJ, setConsultandoCNPJ] = useState(false)

  // Modal Seletor de Local
  const [modalLocal, setModalLocal] = useState(false)
  const [buscaLocal, setBuscaLocal] = useState('')

  // Modal Automação de Estrutura
  const [modalAutomacao, setModalAutomacao] = useState(false)
  const [perfilSelecionadoId, setPerfilSelecionadoId] = useState('')
  const [regrasDoPerfilAtivo, setRegrasDoPerfilAtivo] = useState<RegraOrcamento[]>([])
  const [loadingRegras, setLoadingRegras] = useState(false)
  const [novoPerfilNome, setNovoPerfilNome] = useState('')
  const [criandoPerfil, setCriandoPerfil] = useState(false)
  const [novaRegra, setNovaRegra] = useState<Partial<RegraOrcamento>>({ tipo_regra: 'Por Pessoa', divisor: 1 })
  const [salvandoRegra, setSalvandoRegra] = useState(false)
  const [carregandoEstrutura, setCarregandoEstrutura] = useState(false)
  const [confirmDeleteRegraId, setConfirmDeleteRegraId] = useState<string | null>(null)
  const [editandoRegraId, setEditandoRegraId] = useState<string | null>(null)
  const [confirmTrocaTipoPessoaOpen, setConfirmTrocaTipoPessoaOpen] = useState(false)
  const [pendingTipoPessoa, setPendingTipoPessoa] = useState<'PJ' | 'PF' | null>(null)

  // Imagem do circuito
  const [imagemCircuito, setImagemCircuito] = useState<string>('')

  // Termos e condições
  const [condPagtoPadrao, setCondPagtoPadrao] = useState('50% no aceite e 50% na entrega dos kits')
  const [condPagto, setCondPagto] = useState('50% no aceite e 50% na entrega dos kits')
  const [condValidade, setCondValidade] = useState('10 dias corridos')
  const [condEntrega, setCondEntrega] = useState('Até 2 dias antes do evento')
  const [setupMinimo, setSetupMinimo] = useState(1200)
  const [limiteSetupPessoas, setLimiteSetupPessoas] = useState(150)
  const [termos, setTermos] = useState(TERMOS_PADRAO)
  const [comercialEstruturado, setComercialEstruturado] = useState<ComercialEstruturado>(COMERCIAL_DEFAULTS)

  const clienteInputRef = useRef<HTMLInputElement>(null)
  const qtdPessoasRef = useRef<HTMLInputElement>(null)
  const localSearchInputRef = useRef<HTMLInputElement>(null)
  const localOptionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [localFocusIndex, setLocalFocusIndex] = useState(0)

  // ������ Carregamento inicial ������������������������������������������������������������������������������������������������
  useEffect(() => {
    setLoadingCatalogos(true)
    Promise.all([
      empresas.listar(),
      locais.listar(),
      insumos.listar(),
      orcamentos.listarPendentes(),
      orcamentos.listarPropostas(),
      perfisOrcamento.listar(),
      configuracoes.buscar().catch(() => null),
    ])
      .then(([rEmpresas, rLocais, rInsumos, rPedidos, rPropostas, rPerfis, rConfiguracoes]) => {
        setEmpresasList(rEmpresas.data ?? [])
        setLocaisList((rLocais.data ?? []).filter(l => l.ativo))
        setInsumosList((rInsumos.data ?? []).filter(i => i.ativo))
        setPedidosList(rPedidos.data ?? [])
        setPropostasRecentes(rPropostas.data ?? [])
        setPerfis(rPerfis.data ?? [])
        const texto = rConfiguracoes?.data?.texto_condicoes_pagamento?.trim()
        if (texto) {
          setCondPagtoPadrao(texto)
          setCondPagto(texto)
        }
        if (typeof rConfiguracoes?.data?.setup_minimo === 'number') {
          setSetupMinimo(Number(rConfiguracoes.data.setup_minimo) || 0)
        }
        if (typeof rConfiguracoes?.data?.limite_setup_pessoas === 'number') {
          setLimiteSetupPessoas(Math.max(1, Number(rConfiguracoes.data.limite_setup_pessoas) || 1))
        }
      })
      .catch(() => toast.error('Erro ao carregar dados do gerador'))
      .finally(() => setLoadingCatalogos(false))
  }, [])

  // ������ Derivações ��������������������������������������������������������������������������������������������������������������������
  const today = new Date().toISOString().split('T')[0]
  const dataForaPrazo = !cadastroRetroativo && !!dataEvento && dataEvento < today

  const localSelecionado = locaisList.find(l => l.id === localId)
  const empresaSelecionada = empresasList.find(e => e.id === empresaId)
  const pedidoSelecionado = pedidosList.find(p => p.id === pedidoId)
  const pendingTipoPessoaLabel = pendingTipoPessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'

  const subtotais = useMemo(
    () => items.map(item => Math.max(item.qtd || 0, 0) * Math.max(item.valorUnit || 0, 0)),
    [items]
  )
  const subtotalItens = useMemo(() => subtotais.reduce((acc, curr) => acc + curr, 0), [subtotais])
  const hasInfraItem = useMemo(
    () => items.some(i => isAutoLocalItem(i)),
    [items]
  )
  const taxaLocal = useMemo(
    () => computeTaxaLocal(localSelecionado, qtdPessoas, setupMinimo, limiteSetupPessoas),
    [localSelecionado, qtdPessoas, setupMinimo, limiteSetupPessoas],
  )
  const baseCalculo = useMemo(() => subtotalItens + (hasInfraItem ? 0 : taxaLocal), [subtotalItens, hasInfraItem, taxaLocal])

  // Modo "Margem %": honorários = % sobre a base; Modo "Por Pessoa": honorários = totalAlvo - base
  const honorariosMargem = baseCalculo * (Math.max(margemGlobal, 0) / 100)
  const totalAlvoPorPessoa = modoPreco === 'porPessoa' && qtdPessoas > 0 ? precoAlvoPessoa * qtdPessoas : 0
  const honorariosPorPessoa = modoPreco === 'porPessoa' ? Math.max(0, totalAlvoPorPessoa - baseCalculo) : 0
  const honorarios = modoPreco === 'porPessoa' ? honorariosPorPessoa : honorariosMargem
  // valorMargem mantido para compatibilidade com os campos de resumo já existentes
  const valorMargem = honorarios
  const totalGeral = baseCalculo + honorarios
  const ticketPorPessoa = qtdPessoas > 0 ? totalGeral / qtdPessoas : 0
  const deferredBuscaLocal = useDeferredValue(buscaLocal)
  const deferredPropostasQ = useDeferredValue(propostasQ)
  const propostasQTerm = deferredPropostasQ.trim().toLowerCase()
  const categoriasInsumo = useMemo(
    () => Array.from(new Set(insumosList.map(i => i.categoria))).sort(),
    [insumosList]
  )
  const insumosPorCategoria = useMemo(() => {
    const map = new Map<string, Insumo[]>()
    for (const insumo of insumosList) {
      const list = map.get(insumo.categoria) ?? []
      list.push(insumo)
      map.set(insumo.categoria, list)
    }
    return map
  }, [insumosList])
  const insumoById = useMemo(
    () => new Map(insumosList.map(insumo => [insumo.id, insumo] as const)),
    [insumosList]
  )

  useEffect(() => {
    if (!localSelecionado) return
    const nome = obterAutoLocalNome()
    const descricao = obterAutoLocalDescricao(localSelecionado.nome)
    const taxa = computeTaxaLocal(localSelecionado, qtdPessoas, setupMinimo, limiteSetupPessoas)
    setItems(prev => {
      let alterou = false
      const next = prev.map(item => {
        if (!isAutoLocalItem(item)) return item
        if (
          item.nome === nome &&
          item.descricao === descricao &&
          item.valorUnit === taxa &&
          item.qtd === 1
        ) {
          return item
        }
        alterou = true
        return {
          ...item,
          nome,
          descricao,
          valorUnit: taxa,
          qtd: 1,
          categoria: 'Infraestrutura',
        }
      })
      return alterou ? next : prev
    })
  }, [cadastroRetroativo, localSelecionado, qtdPessoas, setupMinimo, limiteSetupPessoas])

  function formatPedidoLabel(p: OrcamentoPendente) {
    return `${p.responsavel} · ${p.empresa_nome} · ${p.modalidade || 'Sem modalidade'}${p.qtd_participantes ? ` · ${p.qtd_participantes} pessoas` : ''}`
  }

  // ������ Lógicas de negócio ����������������������������������������������������������������������������������������������������

  function limparTela() {
    setPropostaAtualId('')
    setPedidoId('')
    setEmpresaId('')
    setLocalId('')
    setEventoNome('')
    setDataEvento('')
    setHoraChegada('')
    setQtdPessoas(0)
    setKmEvento(0)
    setResponsavel('')
    setEmail('')
    setTelefone('')
    setCidadeEvento('')
    setObservacoes('')
    setMargemGlobal(0)
    setModoPreco('margem')
    setPrecoAlvoPessoa(0)
    setCadastroRetroativo(false)
    setRetroDetalharEscopo(false)
    setRetroValorTotal('')
    setRetroValorPago('')
    setSincronizarQtd(false)
    setItems([{ ...EMPTY_ITEM, id: crypto.randomUUID() }])
    setImagemCircuito('')
    setCondPagto(condPagtoPadrao)
    setCondValidade('10 dias corridos')
    setCondEntrega('Até 2 dias antes do evento')
    setTermos(TERMOS_PADRAO)
  }

  useEffect(() => {
    const geradas = buildCondicoesFromComercial(comercialEstruturado)
    setCondPagto(geradas.condPagto)
    setCondValidade(geradas.condValidade)
    setCondEntrega(geradas.condEntrega)
  }, [comercialEstruturado])

  function removerItemInfraestrutura() {
    setItems(prev => prev.filter(i => !isAutoLocalItem(i)))
  }

  function obterAutoLocalNome() {
    return cadastroRetroativo ? 'Registro Retroativo Consolidado' : 'Infraestrutura e Log\u00edstica'
  }

  function obterAutoLocalDescricao(localNome: string) {
    if (cadastroRetroativo) {
      return `Registro consolidado do evento retroativo realizado no local ${localNome}.`
    }
    return 'Serviços de infraestrutura e logística operacional para execução do evento.'
  }

  function aplicarInfraestruturaDoLocal(local: Local, qtdBase: number) {
    const taxa = computeTaxaLocal(local, qtdBase, setupMinimo, limiteSetupPessoas)
    const nome = obterAutoLocalNome()
    const desc = obterAutoLocalDescricao(local.nome)

    setItems(prev => [
      ...prev.filter(i => !isAutoLocalItem(i)),
      {
        id: crypto.randomUUID(),
        insumoId: '',
        nome,
        descricao: desc,
        qtd: 1,
        valorUnit: taxa,
        categoria: 'Infraestrutura',
      }
    ])
  }

  function carregarPedido(id: string) {
    setPropostaAtualId('')
    setPedidoId(id)
    if (!id) return
    const pedido = pedidosList.find(p => p.id === id)
    if (!pedido) return

    const emp = empresasList.find(e =>
      e.razao_social.toLowerCase() === pedido.empresa_nome.toLowerCase()
    )
    if (emp) setEmpresaId(emp.id)
    else setEmpresaId('')

    setResponsavel(formatPersonName(pedido.responsavel || ''))
    setEmail(String(pedido.email || '').toLowerCase().trim())
    setTelefone(formatPhone(pedido.telefone || ''))
    if (pedido.data_interesse) setDataEvento(pedido.data_interesse.split('T')[0])
    if (pedido.modalidade) setEventoNome(formatEventName(`Evento ${pedido.modalidade}`))
    if (pedido.qtd_participantes) setQtdPessoas(pedido.qtd_participantes)
    if (pedido.km) setKmEvento(Number(pedido.km) || 0)
    const qtdBase = pedido.qtd_participantes || qtdPessoas || 0

    if (pedido.local_nome) {
      const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      const localMatch = locaisList.find(l => normalize(l.nome) === normalize(pedido.local_nome!))
      if (localMatch) {
        setLocalId(localMatch.id)
        if (localMatch.cidade) setCidadeEvento(formatPersonName(localMatch.cidade))
        aplicarInfraestruturaDoLocal(localMatch, qtdBase)
      } else {
        setLocalId('')
        if (pedido.cidade) setCidadeEvento(formatPersonName(pedido.cidade))
        removerItemInfraestrutura()
      }
    } else {
      setLocalId('')
      removerItemInfraestrutura()
    }
  }

  function carregarEmpresa(id: string) {
    setEmpresaId(id)
    if (!id) return
    const e = empresasList.find(item => item.id === id)
    if (!e) return
    setResponsavel(formatPersonName(e.responsavel || ''))
    setEmail(String(e.email || '').toLowerCase().trim())
    setTelefone(formatPhone(e.telefone || ''))
  }

  function addItem() {
    setItems(prev => [
      ...prev,
      { ...EMPTY_ITEM, id: crypto.randomUUID(), qtd: sincronizarQtd ? Math.max(qtdPessoas, 1) : 1 },
    ])
  }

  function removeItem(id: string) {
    setItems(prev => (prev.length === 1 ? prev : prev.filter(i => i.id !== id)))
  }

  function updateItem(id: string, field: keyof OrcamentoItem, value: string | number) {
    setItems(prev =>
      prev.map(item => (item.id !== id ? item : { ...item, [field]: value }))
    )
  }

  function selecionarInsumo(idItem: string, insumoId: string) {
    const insumo = insumosList.find(i => i.id === insumoId)
    if (!insumo) {
      updateItem(idItem, 'insumoId', '')
      return
    }
    setItems(prev =>
      prev.map(item => {
        if (item.id !== idItem) return item
        return {
          ...item,
          insumoId,
          nome: insumo.nome,
          descricao: insumo.descricao || insumo.categoria,
          valorUnit: Number(insumo.preco_unitario || 0),
          categoria: insumo.categoria,
          qtd: sincronizarQtd ? Math.max(qtdPessoas, 1) : item.qtd,
        }
      })
    )
  }

  function trocarModoPreco(modo: 'margem' | 'porPessoa') {
    setModoPreco(modo)
    if (modo === 'margem') {
      setPrecoAlvoPessoa(0)
    } else {
      setMargemGlobal(0)
      // Pré-preenche o campo com o ticket atual se já houver base
      if (ticketPorPessoa > 0) setPrecoAlvoPessoa(Math.round(ticketPorPessoa))
    }
  }

  function calcularMargemPorTicket() {
    if (modoPreco !== 'porPessoa' || precoAlvoPessoa <= 0 || qtdPessoas <= 0) {
      toast.warning('Defina a quantidade de pessoas e o preço alvo por pessoa')
      return
    }
    if (baseCalculo <= 0) {
      toast.warning('Adicione itens ao escopo antes de calcular')
      return
    }
    // No modo porPessoa o totalGeral já é calculado reativamente — só confirma
    toast.success(`Total: ${formatCurrency(totalGeral)} — Honorários: ${formatCurrency(honorarios)}`)
  }

  function handleImagemCircuito(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImagemCircuito(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function selecionarLocal(id: string) {
    setLocalId(id)
    setModalLocal(false)
    if (id) {
      const local = locaisList.find(l => l.id === id)
      if (local) {
        setCidadeEvento(formatPersonName(local.cidade || ''))
        aplicarInfraestruturaDoLocal(local, qtdPessoas)
      }
    } else {
      setCidadeEvento('')
      removerItemInfraestrutura()
    }
    setTimeout(() => qtdPessoasRef.current?.focus(), 150)
  }

  function focusLocalOption(index: number) {
    setLocalFocusIndex(index)
    window.requestAnimationFrame(() => {
      localOptionRefs.current[index]?.focus()
    })
  }

  function getLocalGridColumns() {
    if (typeof window === 'undefined') return 1
    return window.matchMedia('(min-width: 640px)').matches ? 2 : 1
  }

  function handleLocalOptionKeyDown(index: number, event: React.KeyboardEvent<HTMLButtonElement>) {
    if (locaisFiltrados.length === 0) return

    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      localSearchInputRef.current?.focus()
      return
    }

    const columns = getLocalGridColumns()
    let nextIndex = index

    if (event.key === 'ArrowDown') nextIndex = Math.min(index + columns, locaisFiltrados.length - 1)
    if (event.key === 'ArrowUp') nextIndex = Math.max(index - columns, 0)
    if (event.key === 'ArrowRight') nextIndex = Math.min(index + 1, locaisFiltrados.length - 1)
    if (event.key === 'ArrowLeft') nextIndex = Math.max(index - 1, 0)
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = locaisFiltrados.length - 1

    if (nextIndex !== index) {
      event.preventDefault()
      focusLocalOption(nextIndex)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selecionarLocal(locaisFiltrados[index].id)
    }
  }

  function aplicarSincronizacaoQTD(enabled: boolean) {
    setSincronizarQtd(enabled)
    if (!enabled) return
    setItems(prev => prev.map(item => (
      isAutoLocalItem(item)
        ? { ...item, qtd: 1 }
        : { ...item, qtd: Math.max(qtdPessoas, 1) }
    )))
  }

  function handleQtdPessoas(value: string) {
    const next = Number(value || 0)
    setQtdPessoas(next)
    if (sincronizarQtd) {
      setItems(prev => prev.map(item => (
        isAutoLocalItem(item)
          ? { ...item, qtd: 1 }
          : { ...item, qtd: Math.max(next, 1) }
      )))
    }
    // Atualiza valorUnit do item de Infraestrutura com base no novo qtd
    if (localSelecionado) {
      const novoValor = computeTaxaLocal(localSelecionado, next, setupMinimo, limiteSetupPessoas)
      setItems(prev => prev.map(item =>
        isAutoLocalItem(item)
          ? { ...item, valorUnit: novoValor }
          : item
      ))
    }
  }


    function resetNovoClienteForm() {
      setNcDocumento('')
      setNcDocumentoError('')
      setNcRazaoSocial('')
      setNcNomeFantasia('')
      setNcResponsavel('')
      setNcTelefone('')
      setNcEmail('')
      setNcCidade('')
      setNcUF('')
      setNcCEP('')
      setNcLogradouro('')
      setNcNumero('')
    }

    function isNovoClienteFormDirty() {
      return [
        ncDocumento,
        ncRazaoSocial,
        ncNomeFantasia,
        ncResponsavel,
        ncTelefone,
        ncEmail,
        ncCidade,
        ncUF,
        ncCEP,
        ncLogradouro,
        ncNumero,
      ].some(v => v.trim().length > 0)
    }

    function handleToggleNovoCliente() {
      if (showNovoCliente) {
        setShowNovoCliente(false)
        return
      }

      setEmpresaId('')
      setResponsavel('')
      setEmail('')
      setTelefone('')
      setCidadeEvento('')
      resetNovoClienteForm()
      setShowNovoCliente(true)
    }

    function handleTrocaTipoPessoa(nextTipo: 'PJ' | 'PF') {
      if (nextTipo === tipoPessoa) return
      if (isNovoClienteFormDirty()) {
        setPendingTipoPessoa(nextTipo)
        setConfirmTrocaTipoPessoaOpen(true)
        return
      }

      setTipoPessoa(nextTipo)
      resetNovoClienteForm()
    }

    function confirmarTrocaTipoPessoa() {
      if (!pendingTipoPessoa) return
      setTipoPessoa(pendingTipoPessoa)
      resetNovoClienteForm()
      setPendingTipoPessoa(null)
      setConfirmTrocaTipoPessoaOpen(false)
    }

    function getDocumentoNovoClienteError(value: string, tipo: 'PJ' | 'PF') {
      const digits = digitsOnly(value)
      if (!digits) return `${tipo === 'PJ' ? 'CNPJ' : 'CPF'} é obrigatório`
      if (tipo === 'PJ') {
        if (digits.length !== 14) return 'CNPJ deve ter 14 dígitos'
        if (!isValidCNPJ(digits)) return 'CNPJ inválido'
        return ''
      }
      if (digits.length !== 11) return 'CPF deve ter 11 dígitos'
      if (!isValidCPF(digits)) return 'CPF inválido'
      return ''
    }

    function handleNovoClienteDocumentoChange(value: string) {
      setNcDocumento(digitsOnly(value))
      if (ncDocumentoError) setNcDocumentoError('')
    }

    function handleNovoClienteDocumentoBlur() {
      if (!ncDocumento) return
      setNcDocumentoError(getDocumentoNovoClienteError(ncDocumento, tipoPessoa))
    }
  // ������ Novo Cliente ����������������������������������������������������������������������������������������������������������������

  async function consultarCNPJ() {
    const cnpjLimpo = digitsOnly(ncDocumento)
    if (cnpjLimpo.length !== 14) {
      toast.warning('CNPJ deve ter 14 dígitos')
      return
    }
    setConsultandoCNPJ(true)
    try {
      const r = await empresas.consultarCNPJ(cnpjLimpo)
      const d = r.data
      if (d.nome) setNcRazaoSocial(formatPersonName(d.nome))
      if (d.fantasia) setNcNomeFantasia(formatPersonName(d.fantasia))
      if (d.email) setNcEmail(String(d.email).toLowerCase().trim())
      if (d.telefone) setNcTelefone(formatPhone(d.telefone))
      if (d.logradouro) setNcLogradouro(d.logradouro)
      if (d.numero) setNcNumero(d.numero)
      if (d.municipio) setNcCidade(formatPersonName(d.municipio))
      if (d.uf) setNcUF(d.uf)
      if (d.cep) setNcCEP(d.cep)
      toast.success('Dados encontrados via Receita Federal')
    } catch {
      toast.error('CNPJ não encontrado ou serviço indisponível')
    } finally {
      setConsultandoCNPJ(false)
    }
  }

  async function salvarNovoCliente() {
    const documentoError = getDocumentoNovoClienteError(ncDocumento, tipoPessoa)
    if (documentoError) {
      setNcDocumentoError(documentoError)
      toast.warning(documentoError)
      return
    }

    if (!ncRazaoSocial.trim()) {
      toast.warning('Nome / Razão Social é obrigatório')
      return
    }
    setSavingCliente(true)
    try {
      const r = await empresas.criar({
        documento: digitsOnly(ncDocumento),
        razao_social: formatPersonName(ncRazaoSocial).trim(),
        nome_fantasia: formatPersonName(ncNomeFantasia),
        responsavel: formatPersonName(ncResponsavel),
        telefone: formatPhone(ncTelefone),
        email: ncEmail.toLowerCase().trim(),
        cidade: formatPersonName(ncCidade),
        uf: ncUF,
        cep: ncCEP,
        logradouro: ncLogradouro,
        numero: ncNumero,
        tipo_pessoa: tipoPessoa,
        status: 'Ativo',
      })
      const novaEmpresa: Empresa = {
        id: (r as { data: { id: string } }).data.id,
        documento: digitsOnly(ncDocumento),
        razao_social: formatPersonName(ncRazaoSocial).trim(),
        nome_fantasia: formatPersonName(ncNomeFantasia),
        responsavel: formatPersonName(ncResponsavel),
        telefone: formatPhone(ncTelefone),
        email: ncEmail.toLowerCase().trim(),
        cidade: formatPersonName(ncCidade),
        uf: ncUF,
        cep: ncCEP,
        logradouro: ncLogradouro,
        numero: ncNumero,
        complemento: '',
        bairro: '',
        tipo_pessoa: tipoPessoa,
        status: 'Ativo',
      }
      setEmpresasList(prev => [...prev, novaEmpresa].sort((a, b) => a.razao_social.localeCompare(b.razao_social)))
      setEmpresaId(novaEmpresa.id)
      setResponsavel(formatPersonName(novaEmpresa.responsavel || ''))
      setEmail(String(novaEmpresa.email || '').toLowerCase().trim())
      setTelefone(formatPhone(novaEmpresa.telefone || ''))
      setShowNovoCliente(false)
      toast.success(`Cliente "${ncRazaoSocial}" cadastrado e selecionado`)
      resetNovoClienteForm()
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao cadastrar cliente')
    } finally {
      setSavingCliente(false)
    }
  }

  // ������ Automação de Estrutura ��������������������������������������������������������������������������������������������

  async function abrirAutomacao() {
    setModalAutomacao(true)
    setPerfilSelecionadoId('')
    setRegrasDoPerfilAtivo([])
    setNovoPerfilNome('')
    setNovaRegra({ tipo_regra: 'Por Pessoa', divisor: 1 })
  }

  async function selecionarPerfil(id: string) {
    setPerfilSelecionadoId(id)
    if (!id) { setRegrasDoPerfilAtivo([]); return }
    setLoadingRegras(true)
    try {
      const r = await perfisOrcamento.listarRegras(id)
      setRegrasDoPerfilAtivo(r.data ?? [])
    } catch {
      toast.error('Erro ao carregar regras do perfil')
    } finally {
      setLoadingRegras(false)
    }
  }

  async function criarPerfil() {
    if (!novoPerfilNome.trim()) return
    setCriandoPerfil(true)
    try {
      const r = await perfisOrcamento.criar({ nome: novoPerfilNome.trim() })
      const novo: PerfilOrcamento = {
        id: r.data.id,
        nome: novoPerfilNome.trim(),
        descricao: '',
        ativo: true,
        criado_em: new Date().toISOString(),
      }
      setPerfis(prev => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)))
      setNovoPerfilNome('')
      await selecionarPerfil(novo.id)
      toast.success(`Perfil "${novo.nome}" criado`)
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao criar perfil')
    } finally {
      setCriandoPerfil(false)
    }
  }

  async function adicionarRegra() {
    if (!perfilSelecionadoId || !novaRegra.nome_item?.trim()) {
      toast.warning('Selecione um perfil e informe o nome do item')
      return
    }
    setSalvandoRegra(true)
    try {
      // Se estiver editando: remove a antiga e recria
      if (editandoRegraId) {
        await perfisOrcamento.deletarRegra(editandoRegraId)
        setRegrasDoPerfilAtivo(prev => prev.filter(r => r.id !== editandoRegraId))
        setEditandoRegraId(null)
      }
      const r = await perfisOrcamento.salvarRegra({
        perfil_id: perfilSelecionadoId,
        insumo_id: novaRegra.insumo_id || undefined,
        nome_item: novaRegra.nome_item!.trim(),
        tipo_regra: (novaRegra.tipo_regra as RegraOrcamento['tipo_regra']) ?? 'Por Pessoa',
        divisor: novaRegra.divisor ?? 1,
        categoria: novaRegra.categoria ?? '',
      })
      const nova: RegraOrcamento = {
        id: r.data.id,
        perfil_id: perfilSelecionadoId,
        insumo_id: novaRegra.insumo_id || undefined,
        nome_item: novaRegra.nome_item!.trim(),
        tipo_regra: (novaRegra.tipo_regra as RegraOrcamento['tipo_regra']) ?? 'Por Pessoa',
        divisor: novaRegra.divisor ?? 1,
        categoria: novaRegra.categoria ?? '',
        criado_em: new Date().toISOString(),
      }
      setRegrasDoPerfilAtivo(prev => [...prev, nova])
      setNovaRegra({ tipo_regra: 'Por Pessoa', divisor: 1 })
      toast.success(editandoRegraId ? 'Regra atualizada' : 'Regra adicionada')
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao salvar regra')
    } finally {
      setSalvandoRegra(false)
    }
  }

  async function removerRegra(id: string) {
    setConfirmDeleteRegraId(id)
  }

  async function confirmarExclusaoRegra() {
    if (!confirmDeleteRegraId) return
    const id = confirmDeleteRegraId
    setConfirmDeleteRegraId(null)
    try {
      await perfisOrcamento.deletarRegra(id)
      setRegrasDoPerfilAtivo(prev => prev.filter(r => r.id !== id))
      if (editandoRegraId === id) {
        setEditandoRegraId(null)
        setNovaRegra({ tipo_regra: 'Por Pessoa', divisor: 1 })
      }
    } catch {
      toast.error('Erro ao remover regra')
    }
  }

  function iniciarEditarRegra(r: RegraOrcamento) {
    setEditandoRegraId(r.id)
    setNovaRegra({
      insumo_id: r.insumo_id,
      nome_item: r.nome_item,
      tipo_regra: r.tipo_regra,
      divisor: r.divisor,
      categoria: r.categoria,
    })
  }

  async function carregarEstrutura() {
    if (!perfilSelecionadoId) {
      toast.warning('Selecione um perfil para carregar a estrutura')
      return
    }
    setCarregandoEstrutura(true)
    try {
      const r = await perfisOrcamento.calcularEstrutura(perfilSelecionadoId, qtdPessoas)
      const calculados: ItemCalculado[] = r.data ?? []
      if (calculados.length === 0) {
        toast.warning('Nenhum item calculado. Verifique as regras do perfil.')
        return
      }
      const novosItens: OrcamentoItem[] = calculados.map(ic => {
        const insumo = insumosList.find(i => i.id === ic.insumo_id)
        return {
          id: crypto.randomUUID(),
          insumoId: ic.insumo_id ?? '',
          nome: ic.nome,
          descricao: insumo?.descricao || '',
          qtd: ic.quantidade,
          valorUnit: ic.valor_unitario,
          categoria: ic.categoria,
        }
      })
      // Preserva o item de Infraestrutura e Logística vinculado ao local
      setItems(prev => {
        const infraItem = prev.find(i => isAutoLocalItem(i))
        return infraItem ? [...novosItens, infraItem] : novosItens
      })
      setModalAutomacao(false)
      toast.success(`${novosItens.length} itens carregados do perfil`)
    } catch {
      toast.error('Erro ao calcular estrutura')
    } finally {
      setCarregandoEstrutura(false)
    }
  }

  // ������ Salvar Proposta ����������������������������������������������������������������������������������������������������������

  async function gerarPrevia() {
    if (!eventoNome.trim() || !localId || !empresaId) {
      toast.warning('Preencha cliente, evento e local para salvar a proposta')
      return
    }
    let itensValidos: Array<{
      insumo_id?: string
      nome: string
      descricao: string
      quantidade: number
      valor_unitario: number
    }> = items
      .filter(item => item.nome.trim())
      .map(item => ({
        insumo_id: item.insumoId || undefined,
        nome: item.nome.trim(),
        descricao: item.descricao,
        quantidade: Math.max(item.qtd || 0, 0),
        valor_unitario: Math.max(item.valorUnit || 0, 0),
      }))

    if (cadastroRetroativo && !retroDetalharEscopo && itensValidos.length === 0 && localSelecionado) {
      itensValidos = [
        {
          insumo_id: undefined,
          nome: obterAutoLocalNome(),
          descricao: obterAutoLocalDescricao(localSelecionado.nome),
          quantidade: 1,
          valor_unitario: Math.max(taxaLocal, 0),
        },
      ]
    }

    const precisaEscopoDetalhado = !cadastroRetroativo || retroDetalharEscopo
    if (precisaEscopoDetalhado && itensValidos.length === 0) {
      toast.warning('Adicione ao menos um item no escopo')
      return
    }

    const valorTotalContrato = cadastroRetroativo ? Math.max(Number(retroValorTotal || 0), 0) : totalGeral
    const valorPagoContrato = cadastroRetroativo ? Math.max(Number(retroValorPago || 0), 0) : 0

    if (cadastroRetroativo && !dataEvento) {
      toast.warning('Informe a data do evento retroativo')
      return
    }

    if (cadastroRetroativo && valorTotalContrato <= 0) {
      toast.warning('Informe um valor total retroativo maior que zero')
      return
    }

    if (cadastroRetroativo && valorPagoContrato > valorTotalContrato) {
      toast.warning('Valor pago não pode ser maior que o valor total')
      return
    }

    const observacoesBase = stripCondicoesTag(stripComercialTag(observacoes)).trim()
    const comercialTag = buildComercialTag(comercialEstruturado)
    const condicoesTag = buildCondicoesTag({ condPagto, condValidade, condEntrega })
    const observacoesComOrigem = cadastroRetroativo
      ? [`[origem:retroativo] [retroativo:valor_pago=${valorPagoContrato.toFixed(2)}]`, comercialTag, condicoesTag, observacoesBase].filter(Boolean).join(' ')
      : [comercialTag, condicoesTag, observacoesBase].filter(Boolean).join(' ')

    // Abre a aba imediatamente no clique do usuario para evitar bloqueio de pop-up.
    const previewTab = window.open('', '_blank')
    if (previewTab) {
      previewTab.document.open()
      previewTab.document.write('<html><head><title>Gerando proposta...</title></head><body style="font-family:Arial,sans-serif;padding:24px">Gerando proposta, aguarde...</body></html>')
      previewTab.document.close()
    }

    setSavingProposta(true)
    const fluxoToastId = 'orcamentos-gerar-previa'
    try {
      const r = await orcamentos.criarProposta({
        orcamento_publico_id: pedidoId || undefined,
        empresa_id: empresaSelecionada?.id,
        empresa_nome: empresaSelecionada?.razao_social || 'Cliente sem cadastro',
        responsavel,
        email,
        telefone,
        evento_nome: eventoNome,
        data_evento: dataEvento || undefined,
        hora_chegada: horaChegada || undefined,
        local_id: localSelecionado?.id,
        local_nome: localSelecionado?.nome || '',
        cidade_evento: cidadeEvento,
        qtd_pessoas: qtdPessoas,
        km_evento: kmEvento,
        margem_percent: margemGlobal,
        subtotal_itens: subtotalItens,
        taxa_local: taxaLocal,
        valor_margem: valorMargem,
        valor_total: valorTotalContrato,
        preco_ingresso: ticketPorPessoa > 0 ? ticketPorPessoa : undefined,
        observacoes: observacoesComOrigem,
        status: 'Rascunho',
        itens: itensValidos,
      })

      toast.success('Proposta salva com sucesso', { id: fluxoToastId })
      setPropostaAtualId(r.data.id)

      const novaProposta: Proposta = {
        id: r.data.id,
        empresa_nome: empresaSelecionada?.razao_social || 'Cliente sem cadastro',
        responsavel,
        email,
        telefone,
        evento_nome: eventoNome,
        data_evento: dataEvento || undefined,
        hora_chegada: horaChegada || undefined,
        local_nome: localSelecionado?.nome || '',
        cidade_evento: cidadeEvento,
        qtd_pessoas: qtdPessoas,
        km_evento: kmEvento,
        margem_percent: margemGlobal,
        subtotal_itens: subtotalItens,
        taxa_local: taxaLocal,
        valor_margem: valorMargem,
        valor_total: valorTotalContrato,
        observacoes: observacoesComOrigem,
        status: 'Rascunho',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      }
      setPropostasRecentes(prev => [novaProposta, ...prev])

      await abrirPDF(undefined, undefined, previewTab || undefined)

      try {
        await orcamentos.atualizarStatusProposta(r.data.id, 'Finalizada')
        setPropostasRecentes(prev => prev.map(p => (p.id === r.data.id ? { ...p, status: 'Finalizada' } : p)))
      } catch {
        toast.warning('Proposta salva, mas não foi possível marcar como Finalizada', { id: fluxoToastId })
      }

      try {
        await orcamentos.converterProposta(r.data.id)
        setPropostasRecentes(prev => prev.map(p => (p.id === r.data.id ? { ...p, status: 'Convertida' } : p)))
        toast.success(
          cadastroRetroativo
            ? 'Contrato retroativo registrado no Pipeline como Finalizado'
            : 'Contrato enviado ao Pipeline em Em Negociação',
          { id: fluxoToastId }
        )
      } catch (err) {
        toast.warning((err as Error)?.message || 'Proposta salva, mas não foi possível enviar ao Pipeline automaticamente', { id: fluxoToastId })
      }
    } catch (err) {
      toast.error((err as Error)?.message || 'Erro ao salvar proposta', { id: fluxoToastId })
      if (previewTab && !previewTab.closed) {
        previewTab.close()
      }
    } finally {
      setSavingProposta(false)
    }
  }

  function toPdfDataFromState(): PropostaPdfData {
    const enderecoEmpresa = empresaSelecionada
      ? [
          empresaSelecionada.logradouro,
          empresaSelecionada.numero,
          empresaSelecionada.bairro,
          `${empresaSelecionada.cidade}/${empresaSelecionada.uf}`,
        ].filter(Boolean).join(', ')
      : 'Não informado'

    return {
      nomeEmpresa: empresaSelecionada?.razao_social || 'Cliente não informado',
      documentoEmpresa: empresaSelecionada?.documento || '-',
      responsavel,
      consultorNome: user?.nome || undefined,
      enderecoEmpresa,
      eventoNome: eventoNome || 'Evento não informado',
      dataEvento,
      horaChegada: horaChegada || undefined,
      qtdPessoas,
      kmEvento,
      localNome: localSelecionado?.nome || 'A Definir',
      cidadeEvento: cidadeEvento || localSelecionado?.cidade || '-',
      imagemCircuito,
      condPagto,
      condValidade,
      condEntrega,
      termos,
      pagamentoEntradaPercent: comercialEstruturado.entradaPercent,
      pagamentoQtdParcelas: comercialEstruturado.qtdParcelas,
      pagamentoIntervaloDias: comercialEstruturado.intervaloDias,
      pagamentoPrimeiroVencimentoDias: comercialEstruturado.primeiroVencimentoDias,
      validadeDias: comercialEstruturado.validadeDias,
      entregaDiasAntes: comercialEstruturado.entregaDiasAntes,
      subtotalServicos: subtotalItens,
      honorariosGestao: honorarios,
      ticketMedio: ticketPorPessoa,
      totalGeral: cadastroRetroativo ? Math.max(Number(retroValorTotal || 0), 0) : totalGeral,
      isRetroativo: cadastroRetroativo,
      retroValorTotal: cadastroRetroativo ? Math.max(Number(retroValorTotal || 0), 0) : undefined,
      retroValorPago: cadastroRetroativo ? Math.max(Number(retroValorPago || 0), 0) : undefined,
      itens: items
        .filter(i => i.nome.trim())
        .map(i => ({
          nome: i.nome,
          descricao: i.descricao || '-',
          qtd: i.qtd,
          valorUnit: i.valorUnit,
        })),
    }
  }

  function toPdfDataFromPropostaDetalhe(p: PropostaDetalhe): PropostaPdfData {
    const emp = empresasList.find(e => e.id === p.empresa_id) || empresasList.find(e => e.razao_social === p.empresa_nome)
    const enderecoEmpresa = emp
      ? [emp.logradouro, emp.numero, emp.bairro, `${emp.cidade}/${emp.uf}`].filter(Boolean).join(', ')
      : 'Não informado'
    const isRetro = isPropostaRetroativa(p.observacoes)
    const comercial = parseComercialTag(p.observacoes)
    const condicoesPersistidas = parseCondicoesTag(p.observacoes)
    const condicoes = comercial ? buildCondicoesFromComercial(comercial) : null

    return {
      nomeEmpresa: p.empresa_nome || 'Cliente não informado',
      documentoEmpresa: emp?.documento || '-',
      responsavel: p.responsavel,
      consultorNome: user?.nome || undefined,
      enderecoEmpresa,
      eventoNome: p.evento_nome || 'Evento não informado',
      dataEvento: p.data_evento,
      horaChegada: p.hora_chegada,
      qtdPessoas: Number(p.qtd_pessoas || 0),
      kmEvento: Number(p.km_evento || 0),
      localNome: p.local_nome || 'A Definir',
      cidadeEvento: p.cidade_evento || '-',
      condPagto: condicoesPersistidas?.condPagto || condicoes?.condPagto || condPagtoPadrao,
      condValidade: condicoesPersistidas?.condValidade || condicoes?.condValidade || condValidade,
      condEntrega: condicoesPersistidas?.condEntrega || condicoes?.condEntrega || condEntrega,
      termos,
      pagamentoEntradaPercent: comercial?.entradaPercent,
      pagamentoQtdParcelas: comercial?.qtdParcelas,
      pagamentoIntervaloDias: comercial?.intervaloDias,
      pagamentoPrimeiroVencimentoDias: comercial?.primeiroVencimentoDias,
      validadeDias: comercial?.validadeDias,
      entregaDiasAntes: comercial?.entregaDiasAntes,
      subtotalServicos: Number(p.subtotal_itens || 0),
      honorariosGestao: Number(p.valor_margem || 0),
      ticketMedio: Number(p.qtd_pessoas || 0) > 0 ? Number(p.valor_total || 0) / Number(p.qtd_pessoas || 0) : 0,
      totalGeral: Number(p.valor_total || 0),
      isRetroativo: isRetro,
      retroValorTotal: isRetro ? Number(p.valor_total || 0) : undefined,
      retroValorPago: isRetro ? parseRetroValorPago(p.observacoes) : undefined,
      itens: (p.itens ?? []).map(i => ({
        nome: i.nome,
        descricao: i.descricao || '-',
        qtd: Number(i.quantidade || 0),
        valorUnit: Number(i.valor_unitario || 0),
      })),
    }
  }

  async function abrirPDF(data?: PropostaPdfData, nomeBase?: string, preOpenedWindow?: Window) {
    const payload = data ?? toPdfDataFromState()
    const nomeArquivo = nomeBase || `Proposta_${(payload.nomeEmpresa || 'Cliente').substring(0, 20).trim().replace(/\s+/g, '_')}_${Date.now().toString().slice(-6)}`
    const ok = await abrirPreviewProposta(payload, nomeArquivo, preOpenedWindow)
    if (!ok) {
      toast.error('Bloqueador de pop-ups ativo. Permita pop-ups para este site e tente novamente.')
    }
    return ok
  }

  async function carregarPropostaSalva(id: string) {
    try {
      const r = await orcamentos.buscarProposta(id)
      const p = r.data
      setPropostaAtualId(p.id)
      setPedidoId(p.orcamento_publico_id || '')
      setEmpresaId(p.empresa_id || '')
      setLocalId(p.local_id || '')
      setEventoNome(p.evento_nome || '')
      setDataEvento(p.data_evento || '')
      setHoraChegada(p.hora_chegada || '')
      setQtdPessoas(Number(p.qtd_pessoas || 0))
      setKmEvento(Number(p.km_evento || 0))
      setResponsavel(p.responsavel || '')
      setEmail(p.email || '')
      setTelefone(p.telefone || '')
      setCidadeEvento(p.cidade_evento || '')
      setObservacoes(stripCondicoesTag(stripComercialTag(p.observacoes || '')))
      setMargemGlobal(Number(p.margem_percent || 0))
      const comercial = parseComercialTag(p.observacoes)
      const condicoesPersistidas = parseCondicoesTag(p.observacoes)
      if (comercial) {
        setComercialEstruturado(comercial)
        const condicoes = buildCondicoesFromComercial(comercial)
        setCondPagto(condicoesPersistidas?.condPagto || condicoes.condPagto)
        setCondValidade(condicoesPersistidas?.condValidade || condicoes.condValidade)
        setCondEntrega(condicoesPersistidas?.condEntrega || condicoes.condEntrega)
      } else if (condicoesPersistidas) {
        setCondPagto(condicoesPersistidas.condPagto || condPagto)
        setCondValidade(condicoesPersistidas.condValidade || condValidade)
        setCondEntrega(condicoesPersistidas.condEntrega || condEntrega)
      }
      const itensCarregados = (p.itens ?? []).map(item => ({
        id: item.id || crypto.randomUUID(),
        insumoId: item.insumo_id || '',
        nome: item.nome || '',
        descricao: item.descricao || '',
        qtd: Number(item.quantidade || 0),
        valorUnit: Number(item.valor_unitario || 0),
        categoria: insumosList.find(i => i.id === item.insumo_id)?.categoria || '',
      }))
      setItems(itensCarregados.length > 0 ? itensCarregados : [{ ...EMPTY_ITEM, id: crypto.randomUUID() }])
      toast.success('Proposta carregada no formulário')
    } catch {
      toast.error('Não foi possível carregar a proposta selecionada')
    }
  }

  async function abrirPdfPropostaSalva(id: string) {
    try {
      const r = await orcamentos.buscarProposta(id)
      const p = r.data
      const ok = await abrirPDF(toPdfDataFromPropostaDetalhe(p), `Proposta_${(p.empresa_nome || 'Cliente').substring(0, 20).trim().replace(/\s+/g, '_')}_${p.id.slice(0, 8)}`)
      if (ok && p.status === 'Rascunho') {
        await orcamentos.atualizarStatusProposta(p.id, 'Finalizada')
        setPropostasRecentes(prev => prev.map(pr => (pr.id === p.id ? { ...pr, status: 'Finalizada' } : pr)))
      }
    } catch {
      toast.error('Não foi possível abrir a proposta em PDF')
    }
  }

  // ������ Render ����������������������������������������������������������������������������������������������������������������������������

  const locaisFiltrados = useMemo(
    () => locaisList.filter(l =>
      `${l.nome} ${l.cidade} ${l.tipo}`.toLowerCase().includes(deferredBuscaLocal.toLowerCase())
    ),
    [locaisList, deferredBuscaLocal]
  )

  useEffect(() => {
    if (!modalLocal) return
    if (locaisFiltrados.length === 0) return

    const selectedIndex = locaisFiltrados.findIndex(l => l.id === localId)
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0
    focusLocalOption(nextIndex)
  }, [modalLocal, locaisFiltrados, localId])
  const propostasFiltradas = useMemo(() => {
    if (!propostasQTerm) return propostasRecentes
    return propostasRecentes.filter(p =>
      `${p.evento_nome} ${p.empresa_nome} ${p.local_nome}`.toLowerCase().includes(propostasQTerm)
    )
  }, [propostasRecentes, propostasQTerm])
  const publicFormUrl = typeof window !== 'undefined' ? `${window.location.origin}/publico/orcamento` : '/publico/orcamento'

  return (
    <div className="space-y-5 pb-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 flex-col sm:flex-row sm:flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Gerador de Orçamentos</h1>
          <p className="text-sm text-muted-foreground">
            Monte propostas comerciais com cálculo inteligente
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => {
              navigator.clipboard.writeText(publicFormUrl)
              toast.success('Link do formulario copiado')
            }}
          >
            <Copy className="h-4 w-4 mr-1" /> Formulario p/ Cliente
          </Button>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={limparTela}>
            Limpar Tela
          </Button>
          <Button
            onClick={gerarPrevia}
            disabled={savingProposta}
            className="w-full sm:w-auto bg-[#f25c05] hover:bg-[#d94f00]"
          >
            <Printer className="h-4 w-4 mr-1" />
            {savingProposta ? 'Salvando...' : 'Gerar Orçamento'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* ���� Coluna principal ���� */}
        <div className="xl:col-span-8 space-y-4">

          {/* Card dados do cliente e evento */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <Users className="h-4 w-4" /> Dados do Cliente & Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-indigo-700">Cadastrar Evento Retroativo</p>
                  <p className="text-xs text-indigo-600">Ative para permitir data passada e informar valor total/pago real.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCadastroRetroativo(prev => {
                      const next = !prev
                      if (next) {
                        setRetroValorTotal(totalGeral > 0 ? totalGeral.toFixed(2) : '')
                        setRetroValorPago('0')
                        setRetroDetalharEscopo(false)
                      } else {
                        setRetroValorTotal('')
                        setRetroValorPago('')
                        setRetroDetalharEscopo(false)
                      }
                      return next
                    })
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cadastroRetroativo ? 'bg-indigo-600' : 'bg-zinc-300'}`}
                  aria-label="Alternar cadastro retroativo"
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${cadastroRetroativo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {cadastroRetroativo && (
                <div className="flex items-center justify-between rounded-lg border border-indigo-200/80 bg-indigo-50/30 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-indigo-700">Detalhar Escopo do Orçamento</p>
                    <p className="text-xs text-indigo-600">Ative somente se quiser lançar itens detalhados do evento retroativo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRetroDetalharEscopo(prev => !prev)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${retroDetalharEscopo ? 'bg-indigo-600' : 'bg-zinc-300'}`}
                    aria-label="Alternar detalhamento do escopo retroativo"
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${retroDetalharEscopo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )}

              {/* Vincular pedido público */}
              <section className="rounded-lg border border-border bg-card p-3 space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wide text-primary">
                  Novos Pedidos - Formulário Público
                </Label>
                {pedidosList.length === 0 ? (
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">✅ Nenhum novo pedido no momento.</p>
                ) : (
                  <Select
                    value={pedidoId}
                    onValueChange={v => carregarPedido(v || '')}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <span className={!pedidoId ? 'text-muted-foreground' : ''}>
                        {pedidoSelecionado ? formatPedidoLabel(pedidoSelecionado) : 'Selecionar pedido...'}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="min-w-[320px] sm:min-w-[640px] max-w-[95vw]">
                      {pedidosList.map(p => (
                        <SelectItem key={p.id} value={p.id} className="py-2">
                          <span className="block w-full break-words whitespace-normal leading-5">
                            {formatPedidoLabel(p)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </section>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Cliente */}
                <div className="md:col-span-12 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      Cliente (Empresa)
                    </Label>
                    <button
                      type="button"
                      onClick={handleToggleNovoCliente}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {showNovoCliente ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showNovoCliente ? 'Fechar' : 'Novo Cliente'}
                    </button>
                  </div>
                  <Select
                    value={empresaId || ''}
                    onValueChange={v => carregarEmpresa(v || '')}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <span className={!empresaId ? 'text-muted-foreground' : ''}>
                        {empresaId
                          ? (empresasList.find(e => e.id === empresaId)?.razao_social ?? empresaId)
                          : 'Selecionar empresa...'}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="min-w-[320px] sm:min-w-[640px] max-w-[95vw]">
                      {empresasList.map(e => (
                        <SelectItem key={e.id} value={e.id} className="py-2">
                          <span className="block w-full break-words whitespace-normal leading-5">{e.razao_social}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Accordion novo cliente */}
                {showNovoCliente && (
                  <div className="md:col-span-12 rounded-lg border border-dashed border-primary/40 bg-muted/20 p-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-primary flex items-center gap-1">
                        <Building2 className="h-4 w-4" /> Cadastrar Novo Cliente
                      </span>
                      <div className="flex items-center rounded-md border overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => handleTrocaTipoPessoa('PJ')}
                          className={`px-3 py-1 ${tipoPessoa === 'PJ' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                          Pessoa Jurídica
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTrocaTipoPessoa('PF')}
                          className={`px-3 py-1 ${tipoPessoa === 'PF' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                          Pessoa Física
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      <div className="md:col-span-4 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}</Label>
                        <div className="flex gap-1">
                          <Input
                            ref={clienteInputRef}
                            value={tipoPessoa === 'PJ' ? maskCNPJ(ncDocumento) : maskCPF(ncDocumento)}
                            onChange={e => handleNovoClienteDocumentoChange(e.target.value)}
                            onBlur={handleNovoClienteDocumentoBlur}
                            placeholder={tipoPessoa === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                            className={ncDocumentoError ? 'border-destructive focus-visible:ring-destructive/50' : ''}
                          />
                          {tipoPessoa === 'PJ' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={consultarCNPJ}
                              disabled={consultandoCNPJ}
                              className="shrink-0"
                            >
                              {consultandoCNPJ ? '...' : <Search className="h-3 w-3" />}
                            </Button>
                          )}
                        </div>
                        {ncDocumentoError && <p className="text-xs font-medium text-destructive">{ncDocumentoError}</p>}
                      </div>

                      <Field label={tipoPessoa === 'PJ' ? 'Razão Social *' : 'Nome Completo *'} className="md:col-span-8">
                        <BufferedInput value={ncRazaoSocial} onCommit={setNcRazaoSocial} transformOnBlur={formatPersonName} placeholder="Nome / Razão Social" autoCapitalize="words" />
                      </Field>
                      {tipoPessoa === 'PJ' && (
                        <Field label="Nome Fantasia" className="md:col-span-6">
                          <BufferedInput value={ncNomeFantasia} onCommit={setNcNomeFantasia} transformOnBlur={formatPersonName} placeholder="Nome fantasia" autoCapitalize="words" />
                        </Field>
                      )}
                      <Field label="Responsável" className={tipoPessoa === 'PJ' ? 'md:col-span-6' : 'md:col-span-4'}>
                        <BufferedInput value={ncResponsavel} onCommit={setNcResponsavel} transformOnBlur={formatPersonName} placeholder="Nome do responsável" autoCapitalize="words" />
                      </Field>
                      <Field label="Telefone" className="md:col-span-4">
                        <BufferedInput value={ncTelefone} onCommit={setNcTelefone} transformOnChange={formatPhone} placeholder="(00) 00000-0000" />
                      </Field>
                      <Field label="E-mail" className="md:col-span-5">
                        <BufferedInput value={ncEmail} onCommit={setNcEmail} transformOnChange={value => value.toLowerCase().trimStart()} type="email" placeholder="email@empresa.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                      </Field>
                      <Field label="Cidade" className="md:col-span-3">
                        <BufferedInput value={ncCidade} onCommit={setNcCidade} transformOnBlur={formatPersonName} placeholder="Cidade" autoCapitalize="words" />
                      </Field>
                      <Field label="UF" className="md:col-span-2">
                        <Input value={ncUF} onChange={e => setNcUF(e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" />
                      </Field>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={salvarNovoCliente}
                        disabled={savingCliente}
                        className="bg-[#f25c05] hover:bg-[#d94f00]"
                      >
                        {savingCliente ? 'Salvando...' : 'Salvar e Selecionar'}
                      </Button>
                    </div>
                  </div>
                )}

                <Field label="Responsável / Contato" className="md:col-span-5">
                  <BufferedInput value={responsavel} onCommit={setResponsavel} transformOnBlur={formatPersonName} placeholder="Nome do responsável" autoCapitalize="words" />
                </Field>
                <Field label="E-mail" className="md:col-span-4">
                  <BufferedInput value={email} onCommit={setEmail} transformOnChange={value => value.toLowerCase().trimStart()} type="email" placeholder="contato@empresa.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                </Field>
                <Field label="Tel / WhatsApp" className="md:col-span-3">
                  <BufferedInput value={telefone} onCommit={setTelefone} transformOnChange={formatPhone} placeholder="(00) 00000-0000" />
                </Field>

                <Field label="Nome do Evento" className="md:col-span-5">
                  <BufferedInput value={eventoNome} onCommit={setEventoNome} transformOnBlur={formatEventName} placeholder="Ex: Corrida Corporativa 5K" autoCapitalize="words" />
                </Field>
                <Field label="Data Prevista" className="md:col-span-3">
                  <Input type="date" min={cadastroRetroativo ? undefined : today} value={dataEvento} onChange={e => setDataEvento(e.target.value)} />
                  {dataForaPrazo && <p className="text-xs text-destructive mt-1">A data do evento não pode ser no passado.</p>}
                </Field>

                <Field label="Hora de Chegada" className="md:col-span-2">
                  <Input type="time" value={horaChegada} onChange={e => setHoraChegada(e.target.value)} />
                </Field>

                {/* Local � abre modal */}
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Local do Evento</Label>
                  <button
                    type="button"
                    onClick={() => setModalLocal(true)}
                    className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm bg-background hover:bg-muted/40 gap-2"
                  >
                    <span className={localSelecionado ? '' : 'text-muted-foreground'}>
                      {localSelecionado ? localSelecionado.nome : 'Selecione um local⬦'}
                    </span>
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </div>

                <Field label="Qtd. Pessoas" className="md:col-span-3">
                  <Input ref={qtdPessoasRef} type="number" min={0} value={qtdPessoas} onChange={e => handleQtdPessoas(e.target.value)} />
                  {localSelecionado?.capacidade_maxima && qtdPessoas > Number(localSelecionado.capacidade_maxima) && (
                    <p className="text-xs text-destructive mt-1">Capacidade máx. do local: {localSelecionado.capacidade_maxima} pessoas.</p>
                  )}
                </Field>
                <Field label="Km do Evento" className="md:col-span-3">
                  <Input type="number" min={0} value={kmEvento} onChange={e => setKmEvento(Number(e.target.value || 0))} />
                </Field>
                <Field label="Cidade" className="md:col-span-6">
                  <BufferedInput value={cidadeEvento} onCommit={setCidadeEvento} transformOnBlur={formatPersonName} placeholder="Cidade do evento" autoCapitalize="words" />
                </Field>

                {cadastroRetroativo && (
                  <>
                    <Field label="Valor total (retroativo)" className="md:col-span-3">
                      <Input type="number" min={0} step="0.01" value={retroValorTotal} onChange={e => setRetroValorTotal(e.target.value)} placeholder="0,00" />
                    </Field>
                    <Field label="Valor pago (retroativo)" className="md:col-span-3">
                      <Input type="number" min={0} step="0.01" value={retroValorPago} onChange={e => setRetroValorPago(e.target.value)} placeholder="0,00" />
                    </Field>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card escopo */}
          {(!cadastroRetroativo || retroDetalharEscopo) && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Ícone + título */}
                <CardTitle className="text-base text-emerald-700 flex items-center gap-2 shrink-0">
                  <ClipboardList className="h-4 w-4" /> Escopo do Orçamento
                </CardTitle>

                {/* Separador visual */}
                <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

                {/* Dropdown de perfil + Carregar Perfil */}
                <div className="flex items-center gap-1 min-w-0">
                  <Select
                    value={perfilSelecionadoId || ''}
                    onValueChange={v => selecionarPerfil(v || '')}
                  >
                    <SelectTrigger className="h-8 text-xs w-[140px]">
                      <span className={!perfilSelecionadoId ? 'text-muted-foreground' : ''}>
                        {perfilSelecionadoId
                          ? (perfis.find(p => p.id === perfilSelecionadoId)?.nome ?? perfilSelecionadoId)
                          : 'Selecionar perfil'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {perfis.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-primary font-medium px-2"
                    disabled={!perfilSelecionadoId || carregandoEstrutura}
                    onClick={carregarEstrutura}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    {carregandoEstrutura ? 'Calculando...' : 'Carregar Perfil'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    title="Gerenciar perfis e regras"
                    onClick={abrirAutomacao}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Separador */}
                <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

                {/* Toggle Sincronizar Qtd */}
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none shrink-0">
                  <div
                    onClick={() => aplicarSincronizacaoQTD(!sincronizarQtd)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${sincronizarQtd ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${sincronizarQtd ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  Sincronizar Qtd.
                </label>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Adicionar Item */}
                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-3 pt-3 md:px-0 md:pt-0 md:overflow-x-auto">
                <RTable>
                  <RTableHeader>
                    <RTableRow>
                      <RTableHead className="w-[32%]">Item / Serviço</RTableHead>
                      <RTableHead className="w-[28%]">Descrição Detalhada</RTableHead>
                      <RTableHead className="w-[10%] text-center">Qtd</RTableHead>
                      <RTableHead className="w-[14%] text-center">Unit. (R$)</RTableHead>
                      <RTableHead className="w-[14%] text-right pr-4">Subtotal</RTableHead>
                      <RTableHead mobileLabel="" className="w-[2%]" />
                    </RTableRow>
                  </RTableHeader>
                  <RTableBody>
                    {items.map((item, idx) => {
                      const subtotal = subtotais[idx] || 0
                      const isInfra = isAutoLocalItem(item)
                      return (
                        <RTableRow key={item.id}>
                          <RTableCell className="align-top">
                            <Select
                              value={item.insumoId || ''}
                              onValueChange={v => selecionarInsumo(item.id, v || '')}
                              disabled={isInfra}
                            >
                              <SelectTrigger className={`w-full ${isInfra ? '!opacity-100 !text-foreground cursor-not-allowed' : ''}`}>
                                <span>
                                  {item.insumoId
                                    ? (insumoById.get(item.insumoId)?.nome ?? item.nome)
                                    : (item.nome || 'Escolha um item...')}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {categoriasInsumo.map(cat => (
                                  <SelectGroup key={cat}>
                                    <SelectLabel>{cat}</SelectLabel>
                                    {(insumosPorCategoria.get(cat) ?? []).map(ins => (
                                      <SelectItem key={ins.id} value={ins.id}>{ins.nome}</SelectItem>
                                    ))}
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>
                          </RTableCell>
                          <RTableCell>
                            <Input
                              value={item.descricao}
                              onChange={e => updateItem(item.id, 'descricao', e.target.value)}
                              placeholder="Detalhes..."
                              readOnly={isInfra}
                              className={isInfra ? 'cursor-not-allowed' : ''}
                            />
                          </RTableCell>
                          <RTableCell>
                            <Input
                              type="number"
                              min={0}
                              className={`text-center${isInfra ? ' cursor-not-allowed' : ''}`}
                              value={item.qtd}
                              onChange={e => updateItem(item.id, 'qtd', Number(e.target.value || 0))}
                              readOnly={isInfra}
                            />
                          </RTableCell>
                          <RTableCell>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className={`text-center${isInfra ? ' cursor-not-allowed' : ''}`}
                              value={item.valorUnit ?? 0}
                              onChange={e => updateItem(item.id, 'valorUnit', Number(e.target.value || 0))}
                              readOnly={isInfra}
                            />
                          </RTableCell>
                          <RTableCell className="text-right pr-4 font-semibold text-emerald-700">
                            {formatCurrency(subtotal)}
                          </RTableCell>
                          <RTableCell className="text-center px-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeItem(item.id)}
                              disabled={items.length === 1}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </RTableCell>
                        </RTableRow>
                      )
                    })}

                    {/* Linha de Honorários — sempre visível quando há base calculada */}
                    {baseCalculo > 0 && (
                      <RTableRow className="bg-orange-50/60 border-t-2 border-orange-200">
                        <RTableCell className="pl-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-orange-700">Honorários de Gestão AoMenos1km</span>
                            <span className="text-xs text-orange-500 bg-orange-100 rounded px-1.5 py-0.5">
                              {modoPreco === 'margem' ? `${margemGlobal}%` : `R$${precoAlvoPessoa > 0 ? precoAlvoPessoa.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '--'}/pessoa`}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">Gestão, coordenação e serviços operacionais do evento</p>
                        </RTableCell>
                        <RTableCell className="text-sm text-muted-foreground">Faixa calculada automaticamente</RTableCell>
                        <RTableCell className="text-center text-sm text-muted-foreground">—</RTableCell>
                        <RTableCell className="text-center text-sm text-muted-foreground">—</RTableCell>
                        <RTableCell className="text-right pr-4 font-bold text-orange-700">
                          {formatCurrency(honorarios)}
                        </RTableCell>
                        <RTableCell />
                      </RTableRow>
                    )}
                  </RTableBody>
                </RTable>
              </div>

              {/* Rodapé: Modo de Precificação */}
              <div className="px-4 py-3 border-t space-y-3">
                {/* Selector de modo — mutuamente exclusivo */}
                <div className="flex items-start gap-3 flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground shrink-0 pt-1">Modo de precificação:</span>
                  <div className="flex flex-col gap-2 flex-1">
                    {/* Opção Margem % */}
                    <label className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${modoPreco === 'margem' ? 'border-emerald-300 bg-emerald-50/60' : 'border-transparent bg-muted/30 hover:bg-muted/50'}`}>
                      <input
                        type="radio"
                        name="modoPreco"
                        value="margem"
                        checked={modoPreco === 'margem'}
                        onChange={() => trocarModoPreco('margem')}
                        className="accent-emerald-600"
                      />
                      <span className="text-sm font-medium">Margem sobre custos</span>
                      {modoPreco === 'margem' && (
                        <div className="flex items-center gap-1 ml-2">
                          <Input
                            type="number"
                            min={0}
                            className="w-16 h-7 text-xs text-center"
                            value={margemGlobal}
                            onChange={e => setMargemGlobal(Number(e.target.value || 0))}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                          {margemGlobal > 0 && <span className="text-xs text-emerald-700 font-medium">= {formatCurrency(valorMargem)}</span>}
                        </div>
                      )}
                    </label>

                    {/* Opção Preço por Pessoa */}
                    <label className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${modoPreco === 'porPessoa' ? 'border-orange-300 bg-orange-50/60' : 'border-transparent bg-muted/30 hover:bg-muted/50'}`}>
                      <input
                        type="radio"
                        name="modoPreco"
                        value="porPessoa"
                        checked={modoPreco === 'porPessoa'}
                        onChange={() => trocarModoPreco('porPessoa')}
                        className="accent-[#f25c05]"
                      />
                      <span className="text-sm font-medium">Preço-alvo por pessoa (ingresso)</span>
                      {modoPreco === 'porPessoa' && (
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-xs text-muted-foreground">R$</span>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            className="w-24 h-7 text-xs text-center"
                            value={precoAlvoPessoa || ''}
                            onChange={e => setPrecoAlvoPessoa(Number(e.target.value || 0))}
                            placeholder="ex: 159"
                          />
                          <span className="text-xs text-muted-foreground">/pessoa</span>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Total sempre visível */}
                  <div className="flex flex-col items-end gap-1 shrink-0 pt-1">
                    {qtdPessoas > 0 && (
                      <span className="text-xs text-muted-foreground">
                        TICKET: <span className="font-semibold text-foreground">{formatCurrency(ticketPorPessoa)}/pessoa</span>
                      </span>
                    )}
                    <span className="text-base font-bold">
                      TOTAL: <span className="text-emerald-700">{formatCurrency(totalGeral)}</span>
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          )}
          {/* Card: Imagem do Circuito / Evento */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" /> Mapa do Circuito / Imagem do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Anexar imagem do circuito (Google Maps ou Arquivo)
                  </Label>
                  <input
                    type="file"
                    accept="image/*"
                    id="input-imagem-circuito"
                    className="hidden"
                    onChange={handleImagemCircuito}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('input-imagem-circuito')?.click()}
                  >
                    <ImageIcon className="h-3.5 w-3.5 mr-1" /> Selecionar Imagem
                  </Button>
                  <p className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG. Será inserido no PDF final.</p>
                  {imagemCircuito && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive px-0"
                      onClick={() => setImagemCircuito('')}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Remover Imagem
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-center rounded-lg border bg-muted/30 overflow-hidden" style={{ minHeight: 120 }}>
                  {imagemCircuito ? (
                    <img
                      src={imagemCircuito}
                      alt="Preview do circuito"
                      className="max-w-full max-h-48 object-contain rounded"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem imagem</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Termos e Condições */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Termos e Condições
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Parâmetros estruturados das condições comerciais</p>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Texto automático no PDF</Badge>
                </div>
                <div className="rounded-md border border-orange-200 bg-orange-50/70 px-3 py-2 text-xs text-orange-900">
                  <p className="font-semibold">Como preencher:</p>
                  <p>
                    Use estes campos para definir a regra comercial da proposta. Exemplo comum: entrada de 50%, saldo em 2 parcelas,
                    30 dias entre cada parcela e primeiro vencimento 7 dias após a assinatura.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-1">
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">Entrada (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={comercialEstruturado.entradaPercent}
                      onChange={e => {
                        const v = Number(e.target.value || 0)
                        setComercialEstruturado(prev => ({ ...prev, entradaPercent: v, ...(v === 0 ? { qtdParcelas: 1 } : {}) }))
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">Total de parcelas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={comercialEstruturado.qtdParcelas}
                      readOnly={comercialEstruturado.entradaPercent === 0}
                      onChange={e => setComercialEstruturado(prev => ({ ...prev, qtdParcelas: Number(e.target.value || 1) }))}
                      className={`h-8 text-xs${comercialEstruturado.entradaPercent === 0 ? ' bg-muted text-muted-foreground cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">Dias entre parcelas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={comercialEstruturado.intervaloDias}
                      onChange={e => setComercialEstruturado(prev => ({ ...prev, intervaloDias: Number(e.target.value || 30) }))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">Primeiro vencimento (D+)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      value={comercialEstruturado.primeiroVencimentoDias}
                      onChange={e => setComercialEstruturado(prev => ({ ...prev, primeiroVencimentoDias: Number(e.target.value || 0) }))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">Validade (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={comercialEstruturado.validadeDias}
                      onChange={e => setComercialEstruturado(prev => ({ ...prev, validadeDias: Number(e.target.value || 10) }))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">Entrega antes (dias)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={comercialEstruturado.entregaDiasAntes}
                      onChange={e => setComercialEstruturado(prev => ({ ...prev, entregaDiasAntes: Number(e.target.value || 0) }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2">
                  <div className="grid grid-cols-1 gap-1 text-xs text-amber-900 sm:grid-cols-2 lg:grid-cols-3">
                  <p><strong>Entrada (%):</strong> percentual cobrado no aceite/assinatura.</p>
                  <p><strong>Total de parcelas:</strong> quantidade total combinada com o cliente.</p>
                  <p><strong>Dias entre parcelas:</strong> intervalo entre um vencimento e o próximo.</p>
                  <p><strong>Primeiro vencimento em D+:</strong> quantos dias após a assinatura vence a 1ª parcela.</p>
                  <p><strong>Validade:</strong> por quantos dias a proposta comercial fica válida.</p>
                  <p><strong>Entrega antes do evento:</strong> prazo prometido para entrega do material/kit.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévia da proposta (texto final)</p>
              <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900">
                <p>
                  <strong>Resumo para conferência:</strong> os três campos abaixo mostram como ficará o texto final exibido na proposta/PDF.
                </p>
              </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Forma de Pagamento</Label>
                  <div className="min-h-10 rounded-md border bg-muted/20 px-3 py-2 text-sm">{condPagto}</div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Validade da Proposta</Label>
                  <div className="min-h-10 rounded-md border bg-muted/20 px-3 py-2 text-sm">{condValidade}</div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Prazo de Entrega</Label>
                  <div className="min-h-10 rounded-md border bg-muted/20 px-3 py-2 text-sm">{condEntrega}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Regras do Mini-Contrato (Editável)</Label>
                <textarea
                  className="w-full min-h-[160px] rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground leading-relaxed"
                  value={termos}
                  onChange={e => setTermos(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Coluna lateral */}
        <div className="xl:col-span-4 space-y-4">

          {/* Resumo Financeiro */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" /> Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ResumoLinha label="Subtotal dos Itens" valor={formatCurrency(subtotalItens)} />
              {!hasInfraItem && <ResumoLinha label="Taxa do Local" valor={formatCurrency(taxaLocal)} />}

              {/* Honorários — campo editável conforme modo */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Honorários AoMenos1km</span>
                <div className="flex items-center gap-1.5">
                  {modoPreco === 'margem' ? (
                    <>
                      <Input
                        type="number"
                        min={0}
                        className="w-16 h-7 text-xs text-center"
                        value={margemGlobal}
                        onChange={e => setMargemGlobal(Number(e.target.value || 0))}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </>
                  ) : (
                    <>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        className="w-20 h-7 text-xs text-center"
                        value={precoAlvoPessoa || ''}
                        onChange={e => setPrecoAlvoPessoa(Number(e.target.value || 0))}
                        placeholder="R$/pessoa"
                      />
                      <span className="text-xs text-muted-foreground">/p</span>
                    </>
                  )}
                  <span className="font-semibold text-right min-w-[70px]">{formatCurrency(honorarios)}</span>
                </div>
              </div>

              <div className="border-t pt-2">
                <ResumoLinha label="Total Geral" valor={formatCurrency(totalGeral)} destaque />
              </div>

              {qtdPessoas > 0 && (
                <div className="rounded-md bg-muted/40 border px-3 py-2 space-y-1">
                  <ResumoLinha label="Ticket / Pessoa" valor={formatCurrency(ticketPorPessoa)} />
                  {modoPreco === 'porPessoa' && precoAlvoPessoa > 0 && (
                    <ResumoLinha
                      label="Preço-alvo"
                      valor={formatCurrency(precoAlvoPessoa)}
                      destaque={ticketPorPessoa <= precoAlvoPessoa}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inteligência do Local */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Inteligência do Local
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {!localSelecionado ? (
                <p className="text-muted-foreground">Selecione um local para ver as regras de taxa.</p>
              ) : (
                <>
                  <p className="font-semibold text-[#f25c05]">{localSelecionado.nome}</p>
                  <p className="text-xs text-muted-foreground">{localSelecionado.cidade}{localSelecionado.uf ? ` · ${localSelecionado.uf}` : ''}</p>
                  <ResumoLinha
                    label="Cobrança"
                    valor={localSelecionado.tipo_taxa === 'Pessoa' ? 'Por Pessoa' : 'Valor Fixo'}
                  />
                  <ResumoLinha label="Taxa Base" valor={formatCurrency(Number(localSelecionado.taxa_valor || 0))} />
                  <ResumoLinha
                    label="Gatilho"
                    valor={`${Number(localSelecionado.minimo_pessoas || 0)} pessoas`}
                  />
                  <ResumoLinha label="Taxa aplicada" valor={formatCurrency(taxaLocal)} destaque />
                  {localSelecionado.capacidade_maxima && (
                    <p className="text-xs text-muted-foreground">Cap. máx: {localSelecionado.capacidade_maxima} pessoas</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Button
            onClick={gerarPrevia}
            disabled={savingProposta}
            className="w-full bg-[#f25c05] hover:bg-[#d94f00] text-white font-bold tracking-wide"
          >
            <Printer className="h-4 w-4 mr-2" />
            {savingProposta ? 'SALVANDO...' : 'GERAR ORÇAMENTO'}
          </Button>

          {/* Propostas Recentes */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4" /> Propostas Recentes
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => {
                  orcamentos.listarPropostas()
                    .then(r => { setPropostasRecentes(r.data ?? []); setPropostasQ('') })
                    .catch(() => toast.error('Erro ao recarregar propostas'))
                }}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por evento, empresa ou local..."
                  value={propostasQ}
                  onChange={e => setPropostasQ(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(() => {
                const term = propostasQTerm
                const filtered = propostasFiltradas
                if (filtered.length === 0) {
                  return <p className="text-sm text-muted-foreground">{term ? 'Nenhum resultado encontrado.' : 'Nenhuma proposta salva ainda.'}</p>
                }
                return (
                  <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                    {filtered.map(p => (
                      <div
                        key={p.id}
                        onClick={() => carregarPropostaSalva(p.id)}
                        className={`w-full rounded-md border px-3 py-2 text-sm text-left hover:bg-muted/40 transition-colors cursor-pointer ${propostaAtualId === p.id ? 'border-primary bg-primary/5' : ''}`}
                      >
                        <p className="font-semibold truncate">{p.evento_nome || 'Evento sem nome'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.empresa_nome || 'Sem cliente'} · {p.local_nome || 'Sem local'}
                        </p>
                        <div className="flex items-center justify-between mt-1 gap-2">
                          <p className="text-xs font-medium text-emerald-700">{formatCurrency(Number(p.valor_total || 0))}</p>
                          <div className="flex items-center gap-1">
                            {isPropostaRetroativa(p.observacoes) && (
                              <Badge variant="outline" className="text-[10px] h-4 border-indigo-300 bg-indigo-50 text-indigo-700">Retroativo</Badge>
                            )}
                            <Badge variant="outline" className={`text-[10px] h-4 ${statusBadgeClass(p.status)}`}>{p.status || 'Rascunho'}</Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={e => {
                                e.stopPropagation()
                                void abrirPdfPropostaSalva(p.id)
                              }}
                            >
                              <Printer className="h-3.5 w-3.5 text-[#f25c05]" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* Solicitações públicas pendentes */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Novos Pedidos - Formulário Público</CardTitle>
                <div className="flex items-center gap-1">
                  {pedidosList.length > 0 && (
                    <Badge variant="secondary">{pedidosList.length}</Badge>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => {
                    orcamentos.listarPendentes()
                      .then(r => setPedidosList(r.data ?? []))
                      .catch(() => toast.error('Erro ao atualizar pedidos'))
                  }}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCatalogos ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : pedidosList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma solicitação nova no momento.
                </p>
              ) : (
                <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                  {pedidosList.map(p => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => carregarPedido(p.id)}
                      className={`w-full text-left rounded-md border px-3 py-2 hover:bg-muted/40 transition-colors ${pedidoId === p.id ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <p className="text-sm font-medium truncate">{p.responsavel}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.empresa_nome} · {p.modalidade || 'Sem modalidade'}
                        {p.qtd_participantes ? ` · ${p.qtd_participantes} pessoas` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ���� Modal Seletor de Local ���� */}
      {/* ConfirmDialog: Excluir Regra */}
      <ConfirmDialog
        open={!!confirmDeleteRegraId}
        onOpenChange={open => !open && setConfirmDeleteRegraId(null)}
        title="Excluir Regra"
        description="Tem certeza que deseja excluir esta regra? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmarExclusaoRegra}
      />

      <ConfirmDialog
        open={confirmTrocaTipoPessoaOpen}
        onOpenChange={open => {
          setConfirmTrocaTipoPessoaOpen(open)
          if (!open) setPendingTipoPessoa(null)
        }}
        title={`Trocar para ${pendingTipoPessoaLabel}?`}
        description={`Ao trocar para ${pendingTipoPessoaLabel}, os dados preenchidos no formulário serão perdidos.`}
        confirmLabel={`Trocar para ${pendingTipoPessoaLabel}`}
        cancelLabel="Manter como está"
        onConfirm={confirmarTrocaTipoPessoa}
      />

      <Dialog open={modalLocal} onOpenChange={setModalLocal}>
        <DialogContent
          className="max-w-2xl"
          initialFocus={() => {
            const selectedIndex = locaisFiltrados.findIndex(l => l.id === localId)
            const nextIndex = selectedIndex >= 0 ? selectedIndex : 0
            return localOptionRefs.current[nextIndex] ?? undefined
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Selecionar Local do Evento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={localSearchInputRef}
                className="pl-8"
                placeholder="Buscar por nome, cidade ou tipo..."
                value={buscaLocal}
                onChange={e => setBuscaLocal(e.target.value)}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown' && locaisFiltrados.length > 0) {
                    event.preventDefault()
                    focusLocalOption(0)
                  }
                }}
              />
            </div>

            {locaisFiltrados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum local encontrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
                {locaisFiltrados.map((l, idx) => (
                  <button
                    type="button"
                    key={l.id}
                    ref={el => { localOptionRefs.current[idx] = el }}
                    tabIndex={idx === localFocusIndex ? 0 : -1}
                    onFocus={() => setLocalFocusIndex(idx)}
                    onKeyDown={event => handleLocalOptionKeyDown(idx, event)}
                    onClick={() => selecionarLocal(l.id)}
                    className={`text-left rounded-lg border p-3 transition-colors outline-none ${idx === localFocusIndex ? 'border-[#f25c05] bg-orange-50/60 ring-2 ring-[#f25c05]/20' : 'hover:bg-muted/40'} ${localId === l.id ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <p className="font-semibold text-sm">{l.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.cidade}{l.uf ? ` · ${l.uf}` : ''}{l.tipo ? ` · ${l.tipo}` : ''}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {l.tipo_taxa === 'Pessoa' ? 'Por Pessoa' : 'Fixo'}
                      </Badge>
                      <span className="text-muted-foreground">
                        {formatCurrency(Number(l.taxa_valor || 0))}
                        {l.tipo_taxa === 'Pessoa' ? '/pessoa' : ''}
                        {l.minimo_pessoas > 0 ? ` · gatilho ${l.minimo_pessoas}p` : ''}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {localId && (
              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setLocalId(''); setModalLocal(false) }}
                  className="text-muted-foreground"
                >
                  <X className="h-3 w-3 mr-1" /> Remover seleção
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ���� Modal Automação de Estrutura ���� */}
      <Dialog open={modalAutomacao} onOpenChange={setModalAutomacao}>
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden" showCloseButton={false}>
          <div className="bg-[#f25c05] px-6 py-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-white" />
            <span className="text-white font-semibold text-base">Automação de Estrutura</span>
            <button
              type="button"
              onClick={() => setModalAutomacao(false)}
              className="ml-auto text-white/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-6">
            {/* Seleção / criação de perfil */}
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 space-y-1.5 min-w-[160px]">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Perfil</Label>
                <Select
                  value={perfilSelecionadoId || ''}
                  onValueChange={v => selecionarPerfil(v || '')}
                >
                  <SelectTrigger>
                    <span className={!perfilSelecionadoId ? 'text-muted-foreground' : ''}>
                      {perfilSelecionadoId
                        ? (perfis.find(p => p.id === perfilSelecionadoId)?.nome ?? perfilSelecionadoId)
                        : 'Selecione um perfil...'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {perfis.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-1 flex-1 min-w-[180px]">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Novo Perfil</Label>
                  <Input
                    value={novoPerfilNome}
                    onChange={e => setNovoPerfilNome(e.target.value)}
                    placeholder="Nome do perfil (ex: VIP)"
                    onKeyDown={e => e.key === 'Enter' && criarPerfil()}
                  />
                </div>
                <Button size="sm" variant="outline" onClick={criarPerfil} disabled={criandoPerfil || !novoPerfilNome.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Regras do perfil selecionado */}
            {perfilSelecionadoId && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Settings2 className="h-3 w-3" /> Regras do Perfil
                </div>

                {loadingRegras ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : regrasDoPerfilAtivo.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada. Adicione abaixo.</p>
                ) : (
                  <div className="md:rounded-md md:border md:overflow-hidden">
                    <RTable>
                      <RTableHeader>
                        <RTableRow>
                          <RTableHead>Item</RTableHead>
                          <RTableHead>Tipo</RTableHead>
                          <RTableHead className="text-center">Divisor</RTableHead>
                          <RTableHead>Categoria</RTableHead>
                          <RTableHead mobileLabel="" className="w-10" />
                        </RTableRow>
                      </RTableHeader>
                      <RTableBody>
                        {regrasDoPerfilAtivo.map(r => (
                          <RTableRow key={r.id}>
                            <RTableCell className="font-medium">{r.nome_item}</RTableCell>
                            <RTableCell>
                              <Badge variant="outline" className="text-[10px]">{r.tipo_regra}</Badge>
                            </RTableCell>
                            <RTableCell className="text-center">{r.divisor}</RTableCell>
                            <RTableCell className="text-muted-foreground text-xs">{r.categoria || '—'}</RTableCell>
                            <RTableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => iniciarEditarRegra(r)}
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => removerRegra(r.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </RTableCell>
                          </RTableRow>
                        ))}
                      </RTableBody>
                    </RTable>
                  </div>
                )}

                {/* Form adicionar regra */}
                <div className="rounded-lg border border-dashed p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {editandoRegraId ? 'Editando Regra' : 'Adicionar Regra'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-4 space-y-1">
                      <Label className="text-xs text-muted-foreground">Item do Catálogo (opcional)</Label>
                      <Select
                        value={novaRegra.insumo_id || ''}
                        onValueChange={v => {
                          const insumo = insumosList.find(i => i.id === v)
                          setNovaRegra(prev => ({
                            ...prev,
                            insumo_id: v || undefined,
                            nome_item: insumo ? insumo.nome : prev.nome_item,
                            categoria: insumo ? insumo.categoria : prev.categoria,
                          }))
                        }}
                      >
                        <SelectTrigger>
                          <span className={!novaRegra.insumo_id ? 'text-muted-foreground' : ''}>
                            {novaRegra.insumo_id
                              ? (insumosList.find(i => i.id === novaRegra.insumo_id)?.nome ?? novaRegra.insumo_id)
                              : 'Selecionar do catálogo...'}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {categoriasInsumo.map(cat => (
                            <SelectGroup key={cat}>
                              <SelectLabel>{cat}</SelectLabel>
                              {(insumosPorCategoria.get(cat) ?? []).map(ins => (
                                <SelectItem key={ins.id} value={ins.id}>{ins.nome}</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-4 space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome do Item *</Label>
                      <Input
                        value={novaRegra.nome_item || ''}
                        onChange={e => setNovaRegra(prev => ({ ...prev, nome_item: e.target.value }))}
                        placeholder="Ex: Coordenador de Prova"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Tipo</Label>
                      <Select
                        value={novaRegra.tipo_regra || 'Por Pessoa'}
                        onValueChange={v => setNovaRegra(prev => ({ ...prev, tipo_regra: v as RegraOrcamento['tipo_regra'] }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fixo">Fixo</SelectItem>
                          <SelectItem value="Por Pessoa">Por Pessoa</SelectItem>
                          <SelectItem value="Ratio">Ratio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {novaRegra.tipo_regra === 'Fixo' ? 'Qtd Fixa' : novaRegra.tipo_regra === 'Ratio' ? 'Fator' : '1 a cada N'}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={novaRegra.divisor ?? 1}
                        onChange={e => setNovaRegra(prev => ({ ...prev, divisor: Number(e.target.value || 1) }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    {editandoRegraId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditandoRegraId(null); setNovaRegra({ tipo_regra: 'Por Pessoa', divisor: 1 }) }}
                      >
                        Cancelar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={adicionarRegra}
                      disabled={salvandoRegra || !novaRegra.nome_item?.trim()}
                      variant={editandoRegraId ? 'default' : 'outline'}
                      className={editandoRegraId ? 'bg-[#f25c05] hover:bg-[#d94f00]' : ''}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {salvandoRegra ? 'Salvando...' : editandoRegraId ? 'Salvar Edição' : 'Adicionar Regra'}
                    </Button>
                  </div>
                </div>

                {/* Botão carregar estrutura */}
                <div className="flex justify-end pt-1 border-t">
                  <Button
                    onClick={carregarEstrutura}
                    disabled={carregandoEstrutura || !perfilSelecionadoId}
                    className="bg-[#f25c05] hover:bg-[#d94f00]"
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    {carregandoEstrutura ? 'Calculando...' : `Carregar Estrutura (${qtdPessoas || 0} pessoas)`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ������ Subcomponentes ����������������������������������������������������������������������������������������������������������������������

function Field({
  label,
  className = 'md:col-span-12',
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  )
}

function BufferedInput({
  value,
  onCommit,
  transformOnChange,
  transformOnBlur,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onCommit: (value: string) => void
  transformOnChange?: (value: string) => string
  transformOnBlur?: (value: string) => string
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Input
      {...props}
      value={draft}
      onChange={e => {
        const next = transformOnChange ? transformOnChange(e.target.value) : e.target.value
        setDraft(next)
      }}
      onBlur={() => {
        const next = transformOnBlur ? transformOnBlur(draft) : draft
        if (next !== draft) setDraft(next)
        if (next !== value) onCommit(next)
      }}
    />
  )
}

function ResumoLinha({
  label,
  valor,
  destaque = false,
}: {
  label: string
  valor: string
  destaque?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-muted-foreground ${destaque ? 'font-semibold text-foreground' : ''}`}>{label}</span>
      <span className={destaque ? 'font-bold text-foreground' : 'font-semibold'}>{valor}</span>
    </div>
  )
}
