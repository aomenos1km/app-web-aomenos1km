'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { empresas, Empresa, EmpresaCRMInteracao } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RTable,
  RTableBody,
  RTableCell,
  RTableHead,
  RTableHeader,
  RTableRow,
} from '@/components/ui/responsive-table'
import { BellRing, Building2, CalendarCheck2, Handshake, Mail, MapPin, Pencil, Phone, PhoneCall, Plus, Search, SearchCheck, Trash2, User, UserRound, UserRoundPlus, X } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  Ativo: 'bg-green-100 text-green-800',
  Inativo: 'bg-gray-100 text-gray-700',
  Lead: 'bg-amber-100 text-amber-800',
}

const STATUS_OPTIONS = ['Lead', 'Ativo', 'Inativo'] as const

const BLANK: Partial<Empresa> = {
  documento: '',
  razao_social: '',
  nome_fantasia: '',
  responsavel: '',
  telefone: '',
  email: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
  status: 'Lead',
  tipo_pessoa: 'PJ',
}

function onlyDigits(v: string) {
  return (v || '').replace(/\D/g, '')
}

function maskCNPJ(v: string) {
  const d = onlyDigits(v).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function maskCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function maskTelefone(v: string) {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

function maskCEP(v: string) {
  const d = onlyDigits(v).slice(0, 8)
  return d.replace(/(\d{5})(\d)/, '$1-$2')
}

function toTitleCase(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trimStart()
    .replace(/(^|\s)([a-zà-ÿ])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
}

function toDateOnly(value?: string) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

function isPendenciaCRM(data?: string) {
  const ref = toDateOnly(data)
  if (!ref) return false
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return ref.getTime() <= hoje.getTime()
}

function formatDatePtBr(isoDate?: string) {
  if (!isoDate) return '-'
  const d = toDateOnly(isoDate)
  if (!d) return isoDate
  return d.toLocaleDateString('pt-BR')
}

function validarCPF(cpf: string): boolean {
  const d = onlyDigits(cpf)
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(d[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(d[10])
}

function validarCNPJ(cnpj: string): boolean {
  const d = onlyDigits(cnpj)
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const calc = (s: string, w: number[]) => {
    const sum = w.reduce((acc, wt, i) => acc + parseInt(s[i]) * wt, 0)
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return (
    calc(d, [5,4,3,2,9,8,7,6,5,4,3,2]) === parseInt(d[12]) &&
    calc(d, [6,5,4,3,2,9,8,7,6,5,4,3,2]) === parseInt(d[13])
  )
}

function hasFilledFormData(form: Partial<Empresa>) {
  const ignoredKeys = ['status', 'tipo_pessoa']
  return Object.entries(form).some(([key, value]) => {
    if (ignoredKeys.includes(key)) return false
    if (typeof value === 'string') return value.trim() !== ''
    return value !== undefined && value !== null
  })
}

export default function EmpresasPage() {
  const { user } = useAuth()
  const isConsultor = user?.perfil === 'Consultor'
  const router = useRouter()

  const [list, setList] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Empresa | null>(null)
  const [form, setForm] = useState<Partial<Empresa>>(BLANK)
  const [saving, setSaving] = useState(false)
  const [consultandoDoc, setConsultandoDoc] = useState(false)
  const [consultandoCEP, setConsultandoCEP] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [trocaTipoDialogOpen, setTrocaTipoDialogOpen] = useState(false)
  const [trocaTipoPendente, setTrocaTipoPendente] = useState<'PJ' | 'PF' | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteSingleTarget, setDeleteSingleTarget] = useState<Empresa | null>(null)
  const [deleteManyOpen, setDeleteManyOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [crmByEmpresa, setCrmByEmpresa] = useState<Record<string, EmpresaCRMInteracao[]>>({})
  const [loadingCrmEmpresaId, setLoadingCrmEmpresaId] = useState<string | null>(null)
  const [filtroPendenciasAtivo, setFiltroPendenciasAtivo] = useState(false)

  const isPF = (form.tipo_pessoa || 'PJ') === 'PF'

  function carregarLista() {
    setLoading(true)
    empresas
      .listar()
      .then(r => setList(r.data))
      .catch(() => toast.error('Erro ao carregar empresas'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { carregarLista() }, [])

  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => list.some(item => item.id === id)))
  }, [list])

  async function carregarHistoricoCRM(empresaId: string, force = false) {
    if (!force && crmByEmpresa[empresaId]) return
    setLoadingCrmEmpresaId(empresaId)
    try {
      const resp = await empresas.listarCrmInteracoes(empresaId)
      setCrmByEmpresa(prev => ({ ...prev, [empresaId]: resp.data || [] }))
    } catch {
      toast.error('Não foi possível carregar o histórico de CRM')
    } finally {
      setLoadingCrmEmpresaId(current => (current === empresaId ? null : current))
    }
  }

  async function toggleExpand(empresaId: string) {
    setExpandedId(prev => (prev === empresaId ? null : empresaId))
    if (expandedId !== empresaId) {
      await carregarHistoricoCRM(empresaId)
    }
  }

  function abrirNova() {
    setEditTarget(null)
    setForm(BLANK)
    setTrocaTipoPendente(null)
    setTrocaTipoDialogOpen(false)
    setIsReadOnly(false)
    setDialogOpen(true)
  }

  async function abrirEditar(e: Empresa) {
    setEditTarget(e)
    setForm({ ...BLANK, ...e })
    setTrocaTipoPendente(null)
    setTrocaTipoDialogOpen(false)
    setIsReadOnly(false)
    await carregarHistoricoCRM(e.id)
    setDialogOpen(true)
  }

  function aplicarTrocaTipoPessoa(tipo: 'PJ' | 'PF') {
    setForm({
      ...BLANK,
      tipo_pessoa: tipo,
    })
    setDocError(null)
  }

  function handleTipoPessoa(tipo: 'PJ' | 'PF') {
    if ((form.tipo_pessoa || 'PJ') === tipo) {
      return
    }

    if (hasFilledFormData(form)) {
      setTrocaTipoPendente(tipo)
      setTrocaTipoDialogOpen(true)
      return
    }

    aplicarTrocaTipoPessoa(tipo)
  }

  function confirmarTrocaTipoPessoa() {
    if (!trocaTipoPendente) {
      setTrocaTipoDialogOpen(false)
      return
    }

    aplicarTrocaTipoPessoa(trocaTipoPendente)
    setTrocaTipoPendente(null)
    setTrocaTipoDialogOpen(false)
  }

  function cancelarTrocaTipoPessoa() {
    setTrocaTipoPendente(null)
    setTrocaTipoDialogOpen(false)
  }

  function handleChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = ev.target
    let next = value

    if (name === 'documento') {
      next = isPF ? maskCPF(value) : maskCNPJ(value)
      const digits = onlyDigits(next)
      if (isPF && digits.length === 11) {
        setDocError(validarCPF(digits) ? null : 'CPF inválido')
      } else if (!isPF && digits.length === 14) {
        setDocError(validarCNPJ(digits) ? null : 'CNPJ inválido')
      } else {
        setDocError(null)
      }
    }
    if (name === 'telefone') {
      next = maskTelefone(value)
    }
    if (name === 'cep') {
      next = maskCEP(value)
    }
    if (name === 'uf') {
      next = value.toUpperCase().slice(0, 2)
    }
    if (name === 'responsavel') {
      next = toTitleCase(value)
    }

    setForm(prev => ({ ...prev, [name]: next }))
  }

  async function handleBuscarCNPJ() {
    if (isPF) {
      return
    }

    const cnpj = onlyDigits(form.documento || '')
    if (cnpj.length !== 14) {
      toast.warning('Digite um CNPJ válido com 14 números')
      return
    }

    if (!validarCNPJ(cnpj)) {
      setDocError('CNPJ inválido')
      return
    }
    setDocError(null)

    setConsultandoDoc(true)
    try {
      const resp = await empresas.consultarCNPJ(cnpj)
      const d = resp.data
      setForm(prev => ({
        ...prev,
        documento: maskCNPJ(cnpj),
        razao_social: d.nome || prev.razao_social,
        nome_fantasia: d.fantasia || prev.nome_fantasia,
        email: d.email || prev.email,
        telefone: d.telefone ? maskTelefone(d.telefone) : prev.telefone,
        logradouro: d.logradouro || prev.logradouro,
        numero: d.numero || prev.numero,
        bairro: d.bairro || prev.bairro,
        cidade: d.municipio || prev.cidade,
        uf: d.uf || prev.uf,
        cep: d.cep ? maskCEP(d.cep) : prev.cep,
      }))
      toast.success('Dados carregados do CNPJ')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível consultar o CNPJ agora')
    } finally {
      setConsultandoDoc(false)
    }
  }

  async function handleBuscarCEP() {
    const cep = onlyDigits(form.cep || '')
    if (cep.length !== 8) {
      toast.warning('Digite um CEP válido com 8 números')
      return
    }

    setConsultandoCEP(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const d = await res.json()
      if (d.erro) {
        toast.error('CEP não encontrado')
        return
      }
      setForm(prev => ({
        ...prev,
        logradouro: d.logradouro || prev.logradouro,
        bairro: d.bairro || prev.bairro,
        cidade: d.localidade || prev.cidade,
        uf: d.uf || prev.uf,
        complemento: d.complemento || prev.complemento,
      }))
      toast.success('Endereço preenchido pelo CEP')
    } catch {
      toast.error('Erro ao consultar o CEP')
    } finally {
      setConsultandoCEP(false)
    }
  }

  async function handleSave() {
    if (isReadOnly) return

    const payload = {
      ...form,
      documento: onlyDigits(form.documento || ''),
      tipo_pessoa: isPF ? 'PF' : 'PJ',
    }

    if (!form.razao_social || !form.responsavel) {
      toast.error(`${isPF ? 'Nome completo' : 'Razão social'} e responsável são obrigatórios`)
      return
    }

    const digits = onlyDigits(form.documento || '')
    if (digits.length > 0) {
      if (isPF && digits.length === 11 && !validarCPF(digits)) {
        toast.error('CPF inválido')
        return
      }
      if (!isPF && digits.length === 14 && !validarCNPJ(digits)) {
        toast.error('CNPJ inválido')
        return
      }
    }

    setSaving(true)
    try {
      if (editTarget) {
        await empresas.atualizar(editTarget.id, payload)
        toast.success('Cadastro atualizado')
      } else {
        await empresas.criar(payload)
        toast.success('Cadastro criado')
      }

      if (editTarget) {
        await carregarHistoricoCRM(editTarget.id, true)
      }
      setDialogOpen(false)
      carregarLista()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds(prev => {
      if (checked) {
        if (prev.includes(id)) return prev
        return [...prev, id]
      }
      return prev.filter(item => item !== id)
    })
  }

  function isSelected(id: string) {
    return selectedIds.includes(id)
  }

  function toggleSelectGroup(ids: string[], checked: boolean) {
    if (ids.length === 0) return
    setSelectedIds(prev => {
      if (checked) {
        const next = new Set(prev)
        ids.forEach(id => next.add(id))
        return Array.from(next)
      }
      return prev.filter(id => !ids.includes(id))
    })
  }

  async function confirmarExclusaoIndividual() {
    if (!deleteSingleTarget) return
    if (isConsultor) {
      toast.error('Apenas administradores podem excluir empresas')
      return
    }
    setDeleting(true)
    try {
      await empresas.deletar(deleteSingleTarget.id)
      toast.success('Empresa removida com sucesso')
      setSelectedIds(prev => prev.filter(id => id !== deleteSingleTarget.id))
      setDeleteSingleTarget(null)
      carregarLista()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir empresa')
    } finally {
      setDeleting(false)
    }
  }

  async function confirmarExclusaoSelecionadas() {
    if (selectedIds.length === 0) return
    setDeleting(true)
    try {
      const resultados = await Promise.allSettled(selectedIds.map(id => empresas.deletar(id)))
      const ok = resultados.filter(r => r.status === 'fulfilled').length
      const fail = resultados.length - ok

      if (ok > 0) {
        toast.success(`${ok} cadastro(s) removido(s)`)
      }
      if (fail > 0) {
        toast.error(`${fail} cadastro(s) não puderam ser removidos`)
      }

      setDeleteManyOpen(false)
      setSelectedIds([])
      carregarLista()
    } finally {
      setDeleting(false)
    }
  }

  const totalPendenciasCRM = useMemo(
    () => list.filter(item => Boolean(item.crm_pendente) || isPendenciaCRM(item.crm_proximo_contato)).length,
    [list],
  )

  const filtered = useMemo(() => list.filter(e => {
    const matchSearch = `${e.razao_social} ${e.nome_fantasia} ${e.responsavel} ${e.cidade} ${e.documento}`
      .toLowerCase()
      .includes(search.toLowerCase())
    const pendencia = Boolean(e.crm_pendente) || isPendenciaCRM(e.crm_proximo_contato)
    return matchSearch && (!filtroPendenciasAtivo || pendencia)
  }), [list, search, filtroPendenciasAtivo])

  const classificacaoTipoPessoa = (e: Empresa) => {
    if (e.tipo_pessoa === 'PF' || e.tipo_pessoa === 'PJ') {
      return e.tipo_pessoa
    }
    return onlyDigits(e.documento || '').length === 11 ? 'PF' : 'PJ'
  }

  const empresasPJ = useMemo(
    () => filtered.filter(e => classificacaoTipoPessoa(e) === 'PJ'),
    [filtered],
  )

  const pessoasFisicas = useMemo(
    () => filtered.filter(e => classificacaoTipoPessoa(e) === 'PF'),
    [filtered],
  )

  const idsPJ = useMemo(() => empresasPJ.map(e => e.id), [empresasPJ])
  const idsPF = useMemo(() => pessoasFisicas.map(e => e.id), [pessoasFisicas])
  const allPJSelected = idsPJ.length > 0 && idsPJ.every(id => selectedIds.includes(id))
  const allPFSelected = idsPF.length > 0 && idsPF.every(id => selectedIds.includes(id))
  const selectedEmpresas = useMemo(
    () => list.filter(item => selectedIds.includes(item.id)),
    [list, selectedIds],
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-sm text-muted-foreground">{list.length} cadastradas</p>
        </div>
        <Button onClick={abrirNova}>
          <Plus className="h-4 w-4 mr-1" /> Nova Empresa
        </Button>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, documento ou responsável..."
          className="pl-8"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {totalPendenciasCRM > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-bold text-orange-800 flex items-center gap-2">
              <BellRing className="h-4 w-4 animate-pulse" /> Retornos Pendentes (CRM)
            </p>
            <p className="text-sm text-orange-700">
              Você possui <strong>{totalPendenciasCRM}</strong> cliente(s) aguardando contato hoje ou em atraso.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setFiltroPendenciasAtivo(v => !v)}
            className={filtroPendenciasAtivo ? 'bg-slate-600 hover:bg-slate-700' : 'bg-[#f25c05] hover:bg-[#d94f00]'}
          >
            {filtroPendenciasAtivo ? 'Limpar Filtro' : 'Ver Pendências'}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-xl border bg-white p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-white">
            <p className="text-sm text-muted-foreground text-center py-12">Nenhuma empresa encontrada</p>
          </div>
        ) : (
          <>
            {selectedIds.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-amber-900">
                  {selectedIds.length} empresa(s) selecionada(s)
                </p>
                <Button
                  variant="destructive"
                  className="h-9"
                  onClick={() => setDeleteManyOpen(true)}
                  disabled={isConsultor}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir Selecionadas
                </Button>
              </div>
            )}

            <div className="space-y-3 md:space-y-0 md:rounded-xl md:border md:bg-white md:overflow-hidden">
              <div className="border-b px-4 py-3">
                <h3 className="text-[#f25c05] font-semibold">Empresas (Pessoa Jurídica)</h3>
              </div>
              <RTable>
                <RTableHeader>
                  <RTableRow>
                    <RTableHead mobileLabel="" className="w-[52px] px-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#f25c05]"
                        checked={allPJSelected}
                        onChange={(e) => toggleSelectGroup(idsPJ, e.target.checked)}
                        disabled={isConsultor}
                        aria-label="Selecionar todas empresas PJ"
                      />
                    </RTableHead>
                    <RTableHead className="px-4">Razão Social / Fantasia</RTableHead>
                    <RTableHead className="w-[220px] text-center">CNPJ</RTableHead>
                    <RTableHead className="w-[140px] text-center">Status</RTableHead>
                    <RTableHead mobileLabel="" className="w-[130px] text-center px-4">Ações</RTableHead>
                  </RTableRow>
                </RTableHeader>
                <RTableBody>
                  {empresasPJ.length === 0 ? (
                    <RTableRow>
                      <RTableCell className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                        Nenhuma empresa PJ encontrada.
                      </RTableCell>
                    </RTableRow>
                  ) : (
                    empresasPJ.map(e => {
                      const isExpanded = expandedId === e.id
                      const pendente = Boolean(e.crm_pendente) || isPendenciaCRM(e.crm_proximo_contato)
                      const temRetorno = Boolean(e.crm_tem_retorno) || Boolean(e.crm_proximo_contato)
                      const historico = crmByEmpresa[e.id] || []
                      const previewHistorico = historico.slice(0, 2)

                      return (
                        <Fragment key={e.id}>
                          <RTableRow className="cursor-pointer" onClick={() => toggleExpand(e.id)}>
                            <RTableCell className="px-4" onClick={ev => ev.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[#f25c05]"
                                checked={isSelected(e.id)}
                                onChange={(ev) => toggleSelect(e.id, ev.target.checked)}
                                disabled={isConsultor}
                                aria-label={`Selecionar ${e.razao_social}`}
                              />
                            </RTableCell>
                            <RTableCell className="px-4 py-3 align-top whitespace-normal">
                              <p className="font-semibold leading-tight">{e.razao_social}</p>
                              <p className="text-muted-foreground text-sm leading-tight">{e.nome_fantasia || '-'}</p>
                            </RTableCell>
                            <RTableCell className="text-center align-middle">{maskCNPJ(e.documento || '') || '-'}</RTableCell>
                            <RTableCell className="text-center align-middle">
                              <div className="inline-flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-xs ${STATUS_COLORS[e.status] ?? 'bg-gray-100 text-gray-700'}`}
                                >
                                  {e.status}
                                </Badge>
                                {temRetorno && (
                                  pendente
                                    ? <PhoneCall className="h-4 w-4 text-orange-600 animate-pulse" />
                                    : <Phone className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                            </RTableCell>
                            <RTableCell className="px-4 align-middle" onClick={ev => ev.stopPropagation()}>
                              {isConsultor ? (
                                <div className="flex items-center justify-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => abrirEditar(e)}
                                    title="Atualizar CRM"
                                  >
                                    <Pencil className="h-4 w-4 text-slate-600" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => abrirEditar(e)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => setDeleteSingleTarget(e)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </RTableCell>
                          </RTableRow>

                          {isExpanded && (
                            <RTableRow detail>
                              <RTableCell colSpan={5} className="bg-slate-50 px-5 py-5">
                                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1.15fr)] gap-6 items-start">
                                  <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Canais de Contato</h4>
                                    <div className="space-y-3 text-sm">
                                      <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Responsável</p>
                                        <p className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
                                          <UserRound className="h-3.5 w-3.5 text-slate-500" />
                                          <span>{e.responsavel || '-'}</span>
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Contatos</p>
                                        <div className="space-y-1.5 mt-1">
                                          <p className="flex items-center gap-2 text-slate-800">
                                            <Phone className="h-3.5 w-3.5 text-emerald-600" />
                                            <span>{e.telefone || '-'}</span>
                                          </p>
                                          <p className="flex items-center gap-2 text-slate-800">
                                            <Mail className="h-3.5 w-3.5 text-orange-500" />
                                            <span>{e.email || '-'}</span>
                                          </p>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Localização</p>
                                        <p className="mt-1 flex items-center gap-2 text-slate-800">
                                          <MapPin className="h-3.5 w-3.5 text-rose-500" />
                                          <span>{[e.cidade, e.uf].filter(Boolean).join('/') || '-'}</span>
                                        </p>
                                      </div>
                                      {temRetorno && (
                                        <div className="space-y-1">
                                          <Badge className={pendente ? 'bg-red-600 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-600'}>
                                            <CalendarCheck2 className="h-3.5 w-3.5 mr-1" /> Retorno: {formatDatePtBr(e.crm_proximo_contato)}
                                          </Badge>
                                          {e.crm_responsavel_nome && (
                                            <p className="text-xs text-muted-foreground">Em acompanhamento por {e.crm_responsavel_nome}</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="hidden md:block self-stretch w-px bg-slate-200" aria-hidden="true" />

                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Últimas Interações (CRM)</h4>
                                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm border-l-4 border-l-[#f25c05] min-h-[132px]">
                                      {loadingCrmEmpresaId === e.id ? (
                                        <p className="text-sm text-muted-foreground">Carregando interações...</p>
                                      ) : previewHistorico.length > 0 ? (
                                        <div className="space-y-3">
                                          {previewHistorico.map(item => (
                                            <div key={item.id} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                <span className="font-medium text-slate-700">{item.usuario}</span>
                                                <span>{item.data} {item.hora}</span>
                                              </div>
                                              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                                <Badge variant="outline">{item.tipo_interacao || 'Anotação'}</Badge>
                                                <Badge variant="outline">{item.canal || 'WhatsApp'}</Badge>
                                                <Badge variant="outline">{item.resultado || 'Sem Retorno'}</Badge>
                                              </div>
                                              <p className="text-sm mt-1 text-slate-700">{item.texto}</p>
                                              {item.proximo_contato && (
                                                <p className="text-xs mt-2 inline-flex items-center gap-1 rounded bg-orange-100 text-orange-800 px-2 py-1">
                                                  <CalendarCheck2 className="h-3.5 w-3.5" /> Próximo contato: {formatDatePtBr(item.proximo_contato)}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : e.crm_ultimo_texto ? (
                                        <p className="text-sm text-slate-700">{e.crm_ultimo_texto}</p>
                                      ) : (
                                        <p className="text-sm italic text-muted-foreground">Nenhuma interação registrada.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </RTableCell>
                            </RTableRow>
                          )}
                        </Fragment>
                      )
                    })
                  )}
                </RTableBody>
              </RTable>
            </div>

            <div className="space-y-3 md:space-y-0 md:rounded-xl md:border md:bg-white md:overflow-hidden">
              <div className="border-b px-4 py-3">
                <h3 className="text-[#f25c05] font-semibold">Pessoas Físicas</h3>
              </div>
              <RTable>
                <RTableHeader>
                  <RTableRow>
                    <RTableHead mobileLabel="" className="w-[52px] px-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#f25c05]"
                        checked={allPFSelected}
                        onChange={(e) => toggleSelectGroup(idsPF, e.target.checked)}
                        disabled={isConsultor}
                        aria-label="Selecionar todas pessoas físicas"
                      />
                    </RTableHead>
                    <RTableHead className="px-4">Nome Completo</RTableHead>
                    <RTableHead className="w-[220px] text-center">CPF</RTableHead>
                    <RTableHead className="w-[140px] text-center">Status</RTableHead>
                    <RTableHead mobileLabel="" className="w-[130px] text-center px-4">Ações</RTableHead>
                  </RTableRow>
                </RTableHeader>
                <RTableBody>
                  {pessoasFisicas.length === 0 ? (
                    <RTableRow>
                      <RTableCell className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                        Nenhuma pessoa física encontrada.
                      </RTableCell>
                    </RTableRow>
                  ) : (
                    pessoasFisicas.map(e => {
                      const isExpanded = expandedId === e.id
                      const pendente = Boolean(e.crm_pendente) || isPendenciaCRM(e.crm_proximo_contato)
                      const temRetorno = Boolean(e.crm_tem_retorno) || Boolean(e.crm_proximo_contato)
                      const historico = crmByEmpresa[e.id] || []
                      const previewHistorico = historico.slice(0, 2)

                      return (
                        <Fragment key={e.id}>
                          <RTableRow className="cursor-pointer" onClick={() => toggleExpand(e.id)}>
                            <RTableCell className="px-4" onClick={ev => ev.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[#f25c05]"
                                checked={isSelected(e.id)}
                                onChange={(ev) => toggleSelect(e.id, ev.target.checked)}
                                disabled={isConsultor}
                                aria-label={`Selecionar ${e.razao_social}`}
                              />
                            </RTableCell>
                            <RTableCell className="px-4 py-3 align-top whitespace-normal">
                              <p className="font-semibold leading-tight">{e.razao_social}</p>
                              <p className="text-muted-foreground text-sm leading-tight">{e.responsavel || '-'}</p>
                            </RTableCell>
                            <RTableCell className="text-center align-middle">{maskCPF(e.documento || '') || '-'}</RTableCell>
                            <RTableCell className="text-center align-middle">
                              <div className="inline-flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-xs ${STATUS_COLORS[e.status] ?? 'bg-gray-100 text-gray-700'}`}
                                >
                                  {e.status}
                                </Badge>
                                {temRetorno && (
                                  pendente
                                    ? <PhoneCall className="h-4 w-4 text-orange-600 animate-pulse" />
                                    : <Phone className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                            </RTableCell>
                            <RTableCell className="px-4 align-middle" onClick={ev => ev.stopPropagation()}>
                              {isConsultor ? (
                                <div className="flex items-center justify-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => abrirEditar(e)}
                                    title="Atualizar CRM"
                                  >
                                    <Pencil className="h-4 w-4 text-slate-600" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => abrirEditar(e)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => setDeleteSingleTarget(e)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </RTableCell>
                          </RTableRow>

                          {isExpanded && (
                            <RTableRow detail>
                              <RTableCell colSpan={5} className="bg-slate-50 px-5 py-5">
                                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1.15fr)] gap-6 items-start">
                                  <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Canais de Contato</h4>
                                    <div className="space-y-3 text-sm">
                                      <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Responsável</p>
                                        <p className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
                                          <UserRound className="h-3.5 w-3.5 text-slate-500" />
                                          <span>{e.responsavel || '-'}</span>
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Contatos</p>
                                        <div className="space-y-1.5 mt-1">
                                          <p className="flex items-center gap-2 text-slate-800">
                                            <Phone className="h-3.5 w-3.5 text-emerald-600" />
                                            <span>{e.telefone || '-'}</span>
                                          </p>
                                          <p className="flex items-center gap-2 text-slate-800">
                                            <Mail className="h-3.5 w-3.5 text-orange-500" />
                                            <span>{e.email || '-'}</span>
                                          </p>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Localização</p>
                                        <p className="mt-1 flex items-center gap-2 text-slate-800">
                                          <MapPin className="h-3.5 w-3.5 text-rose-500" />
                                          <span>{[e.cidade, e.uf].filter(Boolean).join('/') || '-'}</span>
                                        </p>
                                      </div>
                                      {temRetorno && (
                                        <div className="space-y-1">
                                          <Badge className={pendente ? 'bg-red-600 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-600'}>
                                            <CalendarCheck2 className="h-3.5 w-3.5 mr-1" /> Retorno: {formatDatePtBr(e.crm_proximo_contato)}
                                          </Badge>
                                          {e.crm_responsavel_nome && (
                                            <p className="text-xs text-muted-foreground">Em acompanhamento por {e.crm_responsavel_nome}</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="hidden md:block self-stretch w-px bg-slate-200" aria-hidden="true" />

                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Últimas Interações (CRM)</h4>
                                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm border-l-4 border-l-[#f25c05] min-h-[132px]">
                                      {loadingCrmEmpresaId === e.id ? (
                                        <p className="text-sm text-muted-foreground">Carregando interações...</p>
                                      ) : previewHistorico.length > 0 ? (
                                        <div className="space-y-3">
                                          {previewHistorico.map(item => (
                                            <div key={item.id} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                <span className="font-medium text-slate-700">{item.usuario}</span>
                                                <span>{item.data} {item.hora}</span>
                                              </div>
                                              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                                <Badge variant="outline">{item.tipo_interacao || 'Anotação'}</Badge>
                                                <Badge variant="outline">{item.canal || 'WhatsApp'}</Badge>
                                                <Badge variant="outline">{item.resultado || 'Sem Retorno'}</Badge>
                                              </div>
                                              <p className="text-sm mt-1 text-slate-700">{item.texto}</p>
                                              {item.proximo_contato && (
                                                <p className="text-xs mt-2 inline-flex items-center gap-1 rounded bg-orange-100 text-orange-800 px-2 py-1">
                                                  <CalendarCheck2 className="h-3.5 w-3.5" /> Próximo contato: {formatDatePtBr(item.proximo_contato)}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : e.crm_ultimo_texto ? (
                                        <p className="text-sm text-slate-700">{e.crm_ultimo_texto}</p>
                                      ) : (
                                        <p className="text-sm italic text-muted-foreground">Nenhuma interação registrada.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </RTableCell>
                            </RTableRow>
                          )}
                        </Fragment>
                      )
                    })
                  )}
                </RTableBody>
              </RTable>
            </div>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[880px] p-0 overflow-hidden border border-orange-200" showCloseButton={false}>
          <div className="bg-[#f25c05] text-white px-5 py-3 flex items-center justify-between">
            <h2 className="font-bold text-[30px] leading-none flex items-center gap-2">
              <UserRoundPlus className="h-5 w-5" /> Ficha de Cadastro
            </h2>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="text-white/90 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[82vh] overflow-y-auto p-4 sm:p-5 space-y-4 bg-background">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm font-semibold mb-2">Tipo de Cliente:</p>
              <div className="grid grid-cols-2 border border-[#f25c05] rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleTipoPessoa('PJ')}
                  disabled={isReadOnly}
                  className={`h-10 font-semibold flex items-center justify-center gap-2 transition-colors ${!isPF ? 'bg-[#f25c05] text-white' : 'bg-card text-[#f25c05]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Building2 className="h-4 w-4" /> Pessoa Jurídica
                </button>
                <button
                  type="button"
                  onClick={() => handleTipoPessoa('PF')}
                  disabled={isReadOnly}
                  className={`h-10 font-semibold flex items-center justify-center gap-2 transition-colors ${isPF ? 'bg-[#f25c05] text-white' : 'bg-card text-[#f25c05]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <User className="h-4 w-4" /> Pessoa Física
                </button>
              </div>
            </div>

            <section className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="text-[#f25c05] font-semibold text-sm">DADOS PRINCIPAIS</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label={isPF ? 'CPF' : 'CNPJ'} id="documento">
                  <div className="flex gap-2">
                    <Input
                      name="documento"
                      value={form.documento ?? ''}
                      onChange={handleChange}
                      placeholder={isPF ? '000.000.000-00' : '00.000.000/0000-00'}
                      disabled={isReadOnly}
                      className={docError ? 'border-red-500' : ''}
                    />
                    {!isPF && (
                      <Button type="button" variant="outline" onClick={handleBuscarCNPJ} disabled={consultandoDoc || isReadOnly}>
                        <SearchCheck className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {docError && <p className="text-xs text-red-500 mt-1">{docError}</p>}
                </F>
                <F label={isPF ? 'Nome Completo *' : 'Razão Social *'} id="razao_social">
                  <Input name="razao_social" value={form.razao_social ?? ''} onChange={handleChange} required  disabled={isReadOnly} />
                </F>
                {!isPF && (
                  <F label="Nome Fantasia" id="nome_fantasia">
                    <Input name="nome_fantasia" value={form.nome_fantasia ?? ''} onChange={handleChange}  disabled={isReadOnly} />
                  </F>
                )}
                <F label="Responsável *" id="responsavel">
                  <Input name="responsavel" value={form.responsavel ?? ''} onChange={handleChange} required  disabled={isReadOnly} />
                </F>
                <F label="Email" id="email">
                  <Input name="email" type="email" value={form.email ?? ''} onChange={handleChange}  disabled={isReadOnly} />
                </F>
                <F label="Telefone" id="telefone">
                  <Input name="telefone" value={form.telefone ?? ''} onChange={handleChange}  disabled={isReadOnly} />
                </F>
                <F label="Status" id="status" className="sm:col-span-2">
                  <Select
                    disabled={isReadOnly}
                    value={form.status ?? 'Lead'}
                    onValueChange={value => setForm(prev => ({ ...prev, status: value || 'Lead' }))}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </F>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="text-[#f25c05] font-semibold text-sm">ENDEREÇO E LOCALIZAÇÃO</h3>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                <F label="CEP" id="cep" className="sm:col-span-2">
                  <div className="flex gap-2">
                    <Input name="cep" value={form.cep ?? ''} onChange={handleChange} placeholder="00000-000"  disabled={isReadOnly} />
                    <Button type="button" variant="outline" onClick={handleBuscarCEP} disabled={consultandoCEP || isReadOnly}>
                      <SearchCheck className="h-4 w-4" />
                    </Button>
                  </div>
                </F>
                <F label="Logradouro" id="logradouro" className="sm:col-span-3">
                  <Input name="logradouro" value={form.logradouro ?? ''} onChange={handleChange}  disabled={isReadOnly} />
                </F>
                <F label="Nº" id="numero" className="sm:col-span-1">
                  <Input name="numero" value={form.numero ?? ''} onChange={handleChange}  disabled={isReadOnly} />
                </F>
                <F label="Complemento" id="complemento" className="sm:col-span-2">
                  <Input name="complemento" value={form.complemento ?? ''} onChange={handleChange}  disabled={isReadOnly} />
                </F>
                <F label="Bairro" id="bairro" className="sm:col-span-2">
                  <Input name="bairro" value={form.bairro ?? ''} onChange={handleChange}  disabled={isReadOnly} />
                </F>
                <F label="Cidade" id="cidade" className="sm:col-span-1">
                  <Input name="cidade" value={form.cidade ?? ''} onChange={handleChange}  disabled={isReadOnly} />
                </F>
                <F label="UF" id="uf" className="sm:col-span-1">
                  <Input name="uf" value={form.uf ?? ''} onChange={handleChange} maxLength={2}  disabled={isReadOnly} />
                </F>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="text-[#f25c05] font-semibold text-sm flex items-center gap-2">
                <Handshake className="h-4 w-4" /> GESTÃO DE RELACIONAMENTO (CRM)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5 space-y-3 rounded-md border bg-muted/40 p-3">
                  <p className="text-sm text-foreground">
                    Novas interações e pendências agora são registradas diretamente na fila de CRM para manter o processo centralizado.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false)
                      router.push('/dashboard/crm')
                    }}
                  >
                    Abrir Tela CRM
                  </Button>
                </div>

                <div className="md:col-span-7 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Histórico</p>
                  <div className="max-h-[260px] overflow-y-auto space-y-2 rounded-md border p-3 bg-background">
                    {editTarget && loadingCrmEmpresaId === editTarget.id ? (
                      <p className="text-sm text-muted-foreground">Carregando histórico...</p>
                    ) : (editTarget && (crmByEmpresa[editTarget.id] || []).length > 0) ? (
                      (crmByEmpresa[editTarget.id] || []).map(item => (
                        <div key={item.id} className="rounded-md border bg-muted/40 p-2.5">
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{item.usuario}</span>
                            <span>{item.data} {item.hora}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2 text-xs">
                            <Badge variant="outline">{item.tipo_interacao || 'Anotação'}</Badge>
                            <Badge variant="outline">{item.canal || 'WhatsApp'}</Badge>
                            <Badge variant="outline">{item.resultado || 'Sem Retorno'}</Badge>
                          </div>
                          <p className="text-sm mt-1">{item.texto}</p>
                          {item.proximo_contato && (
                            <p className="text-xs mt-1 inline-flex items-center gap-1 rounded bg-orange-100 text-orange-800 px-2 py-1">
                              <CalendarCheck2 className="h-3.5 w-3.5" /> Retorno agendado: {formatDatePtBr(item.proximo_contato)}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma anotação registrada.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="border-t bg-card px-5 py-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            {!isReadOnly && (
              <Button onClick={handleSave} disabled={saving} className="bg-[#f25c05] hover:bg-[#d94f00]">
                {saving ? 'Salvando...' : 'Salvar Cadastro'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={trocaTipoDialogOpen}
        onOpenChange={(open) => {
          setTrocaTipoDialogOpen(open)
          if (!open) {
            setTrocaTipoPendente(null)
          }
        }}
        title="Trocar tipo de cliente?"
        description="Existem dados preenchidos no formulário. Se continuar, os campos serão limpos."
        onConfirm={confirmarTrocaTipoPessoa}
        confirmLabel="Trocar e limpar"
        cancelLabel="Manter como está"
      >
        <div className="text-sm text-muted-foreground">
          Isso evita perder informações por clique acidental.
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleteSingleTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteSingleTarget(null)
        }}
        title="Excluir Empresa?"
        description="Esta ação remove o cadastro e não pode ser desfeita."
        onConfirm={confirmarExclusaoIndividual}
        confirmLabel="Sim, excluir permanentemente"
        cancelLabel="Cancelar"
        confirmDisabled={deleting}
        destructive
      >
        {deleteSingleTarget && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <p className="font-semibold">Você está removendo:</p>
            <p>{deleteSingleTarget.razao_social}</p>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteManyOpen}
        onOpenChange={setDeleteManyOpen}
        title={`Excluir ${selectedIds.length} Empresa(s)?`}
        description="A exclusão em lote remove os cadastros selecionados permanentemente."
        onConfirm={confirmarExclusaoSelecionadas}
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        confirmDisabled={selectedIds.length === 0 || deleting}
        destructive
      >
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 space-y-1">
          <p>1. O cadastro será removido permanentemente.</p>
          <p>2. O histórico de CRM dessas empresas pode ser perdido.</p>
          <p>3. Esta ação não pode ser desfeita.</p>
        </div>
        {selectedEmpresas.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {selectedEmpresas.slice(0, 3).map(item => item.razao_social).join(' • ')}
            {selectedEmpresas.length > 3 ? ` • +${selectedEmpresas.length - 3} item(ns)` : ''}
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}

function F({ label, id, children, className = '' }: {
  label: string; id: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

