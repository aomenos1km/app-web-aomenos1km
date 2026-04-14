'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, Search, SearchCheck, User } from 'lucide-react'
import { toast } from 'sonner'
import { contratos, empresas, locais, usuariosEquipe, Local, UsuarioEquipe } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type FormState = {
  tipo_pessoa: 'pj' | 'pf'
  documento: string
  empresa_nome: string
  nome_fantasia: string
  responsavel: string
  email: string
  cidade_cliente: string
  uf_cliente: string
  nome_evento: string
  data_evento: string
  local_id: string
  local_nome: string
  local_nao_cadastrado: boolean
  local_cep: string
  local_logradouro: string
  local_numero: string
  local_complemento: string
  local_bairro: string
  local_cidade: string
  local_uf: string
  local_capacidade_maxima: string
  local_responsavel: string
  local_whatsapp: string
  modalidade: string
  qtd_contratada: string
  valor_total: string
  valor_pago: string
  km: string
  consultor: string
  observacoes: string
}

function buildInitialForm(consultor: string, tipoPessoa: 'pj' | 'pf' = 'pj'): FormState {
  return {
    tipo_pessoa: tipoPessoa,
    documento: '',
    empresa_nome: '',
    nome_fantasia: '',
    responsavel: '',
    email: '',
    cidade_cliente: '',
    uf_cliente: '',
    nome_evento: '',
    data_evento: '',
    local_id: '',
    local_nome: '',
    local_nao_cadastrado: false,
    local_cep: '',
    local_logradouro: '',
    local_numero: '',
    local_complemento: '',
    local_bairro: '',
    local_cidade: '',
    local_uf: '',
    local_capacidade_maxima: '',
    local_responsavel: '',
    local_whatsapp: '',
    modalidade: 'Corrida',
    qtd_contratada: '0',
    valor_total: '0',
    valor_pago: '0',
    km: '0',
    consultor,
    observacoes: '',
  }
}

function onlyDigits(value: string) {
  return (value || '').replace(/\D/g, '')
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

function maskCEP(value: string) {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.replace(/(\d{5})(\d)/, '$1-$2')
}

function maskTelefone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

const PARTICULAS_NOME = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e'])

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
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i)
  let digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  if (digit !== Number(cpf[9])) return false

  sum = 0
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i)
  digit = (sum * 10) % 11
  if (digit === 10) digit = 0
  return digit === Number(cpf[10])
}

function isValidCNPJ(value: string) {
  const cnpj = onlyDigits(value)
  if (cnpj.length !== 14) return false
  if (/^(\d)\1+$/.test(cnpj)) return false

  const calc = (base: string, factors: number[]) => {
    const total = base.split('').reduce((acc, cur, idx) => acc + Number(cur) * factors[idx], 0)
    const rest = total % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const first = calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = calc(cnpj.slice(0, 12) + String(first), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return first === Number(cnpj[12]) && second === Number(cnpj[13])
}

export default function ContratoRetroativoPage() {
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'
  const numeroInputRef = useRef<HTMLInputElement | null>(null)

  const [loadingLocais, setLoadingLocais] = useState(true)
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [consultandoCEP, setConsultandoCEP] = useState(false)
  const [consultandoCNPJ, setConsultandoCNPJ] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [documentoTouched, setDocumentoTouched] = useState(false)
  const [confirmTrocaTipoPessoaOpen, setConfirmTrocaTipoPessoaOpen] = useState(false)
  const [pendingTipoPessoa, setPendingTipoPessoa] = useState<'pj' | 'pf' | null>(null)
  const [listaLocais, setListaLocais] = useState<Local[]>([])
  const [listaUsuarios, setListaUsuarios] = useState<UsuarioEquipe[]>([])

  const [form, setForm] = useState<FormState>(() => buildInitialForm(user?.nome || '', 'pj'))

  useEffect(() => {
    setForm(prev => ({ ...prev, consultor: user?.nome || prev.consultor }))
  }, [user?.nome])

  useEffect(() => {
    let ativo = true
    setLoadingLocais(true)
    locais
      .listar()
      .then(r => {
        if (!ativo) return
        setListaLocais((r.data || []).filter(l => l.ativo))
      })
      .catch(() => toast.error('Não foi possível carregar os locais'))
      .finally(() => {
        if (ativo) setLoadingLocais(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    let ativo = true
    setLoadingUsuarios(true)
    usuariosEquipe
      .listar()
      .then(r => {
        if (!ativo) return
        const usuarios = (r.data || []).filter(u => u.ativo)
        setListaUsuarios(usuarios)
      })
      .catch(() => toast.error('Não foi possível carregar os usuários da equipe'))
      .finally(() => {
        if (ativo) setLoadingUsuarios(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  const usuariosAtivos = useMemo(() => {
    return [...listaUsuarios].sort((a, b) => a.nome.localeCompare(b.nome))
  }, [listaUsuarios])

  const documentoDigits = useMemo(() => onlyDigits(form.documento), [form.documento])

  const documentoError = useMemo(() => {
    if (!documentoTouched || !form.documento.trim()) return ''

    if (form.tipo_pessoa === 'pj') {
      if (documentoDigits.length < 14) return 'CNPJ deve ter 14 dígitos'
      if (!isValidCNPJ(form.documento)) return 'CNPJ inválido'
      return ''
    }

    if (documentoDigits.length < 11) return 'CPF deve ter 11 dígitos'
    if (!isValidCPF(form.documento)) return 'CPF inválido'
    return ''
  }, [documentoDigits, documentoTouched, form.documento, form.tipo_pessoa])

  const formTemDadosPreenchidos = useMemo(() => {
    const base = buildInitialForm(user?.nome || '', form.tipo_pessoa)
    return (Object.keys(base) as Array<keyof FormState>).some(key => form[key] !== base[key])
  }, [form, user?.nome])

  const pendingTipoPessoaLabel = pendingTipoPessoa === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleTrocaTipoPessoa(nextTipo: 'pj' | 'pf') {
    if (nextTipo === form.tipo_pessoa) return

    if (formTemDadosPreenchidos) {
      setPendingTipoPessoa(nextTipo)
      setConfirmTrocaTipoPessoaOpen(true)
      return
    }

    setDocumentoTouched(false)
    setForm(buildInitialForm(user?.nome || '', nextTipo))
  }

  function confirmarTrocaTipoPessoa() {
    if (!pendingTipoPessoa) return
    setDocumentoTouched(false)
    setForm(buildInitialForm(user?.nome || '', pendingTipoPessoa))
    setPendingTipoPessoa(null)
    setConfirmTrocaTipoPessoaOpen(false)
  }

  async function buscarCNPJ() {
    const cnpj = onlyDigits(form.documento)
    if (cnpj.length !== 14) {
      toast.warning('Informe um CNPJ com 14 dígitos')
      return
    }
    if (!isValidCNPJ(form.documento)) {
      toast.error('CNPJ inválido')
      return
    }

    setConsultandoCNPJ(true)
    try {
      const res = await empresas.consultarCNPJ(cnpj)
      const dados = res.data
      setForm(prev => ({
        ...prev,
        empresa_nome: dados.nome || prev.empresa_nome,
        nome_fantasia: dados.fantasia || prev.nome_fantasia,
        email: (dados.email || prev.email || '').toLowerCase(),
        cidade_cliente: dados.municipio || prev.cidade_cliente,
        uf_cliente: (dados.uf || prev.uf_cliente || '').toUpperCase(),
      }))
      toast.success('Dados do CNPJ carregados')
    } catch {
      toast.error('Não foi possível buscar os dados do CNPJ automaticamente')
    } finally {
      setConsultandoCNPJ(false)
    }
  }

  async function buscarCEP() {
    const cep = onlyDigits(form.local_cep)
    if (cep.length !== 8) {
      toast.warning('Digite um CEP válido com 8 números')
      return
    }

    setConsultandoCEP(true)
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await response.json()
      if (data.erro) {
        toast.error('CEP não encontrado')
        return
      }

      setForm(prev => ({
        ...prev,
        local_logradouro: data.logradouro || prev.local_logradouro,
        local_bairro: data.bairro || prev.local_bairro,
        local_cidade: data.localidade || prev.local_cidade,
        local_uf: data.uf || prev.local_uf,
        local_complemento: data.complemento || prev.local_complemento,
      }))
      toast.success('Endereço preenchido pelo CEP')
      window.setTimeout(() => {
        numeroInputRef.current?.focus()
      }, 0)
    } catch {
      toast.error('Erro ao consultar o CEP')
    } finally {
      setConsultandoCEP(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!isAdmin) {
      toast.error('Somente administradores podem cadastrar eventos retroativos')
      return
    }

    if (!form.empresa_nome.trim() || !form.nome_evento.trim()) {
      toast.error('Empresa e nome do evento são obrigatórios')
      return
    }

    if (!form.documento.trim()) {
      setDocumentoTouched(true)
      toast.error(form.tipo_pessoa === 'pj' ? 'Informe o CNPJ' : 'Informe o CPF')
      return
    }
    if (form.tipo_pessoa === 'pj' && !isValidCNPJ(form.documento)) {
      setDocumentoTouched(true)
      toast.error('CNPJ inválido')
      return
    }
    if (form.tipo_pessoa === 'pf' && !isValidCPF(form.documento)) {
      setDocumentoTouched(true)
      toast.error('CPF inválido')
      return
    }

    if (!form.data_evento) {
      toast.error('Informe a data do evento')
      return
    }

    if (form.local_nao_cadastrado) {
      if (!form.local_nome.trim()) {
        toast.error('Informe o local quando ele não estiver cadastrado')
        return
      }
    } else if (!form.local_id) {
      toast.error('Selecione um local cadastrado')
      return
    }

    setSalvando(true)
    try {
      const resp = await contratos.criarRetroativo({
        empresa_nome: form.empresa_nome.trim(),
        tipo_pessoa: form.tipo_pessoa,
        documento: form.documento.trim(),
        nome_fantasia: form.nome_fantasia.trim(),
        responsavel: form.responsavel.trim(),
        email: form.email.trim().toLowerCase(),
        cidade_cliente: form.cidade_cliente.trim(),
        uf_cliente: form.uf_cliente.trim().toUpperCase(),
        nome_evento: form.nome_evento.trim(),
        data_evento: form.data_evento,
        local_id: form.local_nao_cadastrado ? undefined : form.local_id,
        local_nome: form.local_nao_cadastrado ? form.local_nome.trim() : undefined,
        local_nao_cadastrado: form.local_nao_cadastrado,
        local_cep: form.local_nao_cadastrado ? form.local_cep.trim() : undefined,
        local_logradouro: form.local_nao_cadastrado ? form.local_logradouro.trim() : undefined,
        local_numero: form.local_nao_cadastrado ? form.local_numero.trim() : undefined,
        local_complemento: form.local_nao_cadastrado ? form.local_complemento.trim() : undefined,
        local_bairro: form.local_nao_cadastrado ? form.local_bairro.trim() : undefined,
        local_cidade: form.local_nao_cadastrado ? form.local_cidade.trim() : undefined,
        local_uf: form.local_nao_cadastrado ? form.local_uf.trim().toUpperCase() : undefined,
        local_capacidade_maxima: form.local_nao_cadastrado && form.local_capacidade_maxima !== ''
          ? Number(form.local_capacidade_maxima)
          : undefined,
        local_responsavel: form.local_nao_cadastrado ? form.local_responsavel.trim() : undefined,
        local_whatsapp: form.local_nao_cadastrado ? form.local_whatsapp.trim() : undefined,
        modalidade: form.modalidade.trim() || 'Corrida',
        qtd_contratada: Number(form.qtd_contratada || '0'),
        valor_total: Number(form.valor_total || '0'),
        valor_pago: Number(form.valor_pago || '0'),
        km: form.km.trim() || '0',
        consultor: form.consultor.trim() || user?.nome || '',
        observacoes: form.observacoes.trim(),
      })

      const id = resp.data?.id
      toast.success('Evento retroativo cadastrado com sucesso')
      if (id) {
        router.push(`/dashboard/contratos/${id}`)
        return
      }
      router.push('/dashboard/contratos')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar evento retroativo')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Cadastro Retroativo de Evento</h1>
          <p className="text-sm text-muted-foreground">Use para registrar eventos que já aconteceram fora do sistema.</p>
        </div>
        <Link href="/dashboard/contratos">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" />Voltar ao Kanban</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Evento Passado</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
            <div className="md:col-span-2 flex items-center gap-2">
              <Button
                type="button"
                variant={form.tipo_pessoa === 'pj' ? 'default' : 'outline'}
                onClick={() => handleTrocaTipoPessoa('pj')}
              >
                <Building2 className="h-4 w-4 mr-1" /> Pessoa Jurídica
              </Button>
              <Button
                type="button"
                variant={form.tipo_pessoa === 'pf' ? 'default' : 'outline'}
                onClick={() => handleTrocaTipoPessoa('pf')}
              >
                <User className="h-4 w-4 mr-1" /> Pessoa Física
              </Button>
            </div>

            <div className="space-y-2">
              <Label>{form.tipo_pessoa === 'pj' ? 'CNPJ' : 'CPF'}</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={form.documento}
                  onChange={e => setField('documento', form.tipo_pessoa === 'pj' ? formatCNPJ(e.target.value) : formatCPF(e.target.value))}
                  onBlur={() => setDocumentoTouched(true)}
                  placeholder={form.tipo_pessoa === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'}
                  maxLength={form.tipo_pessoa === 'pj' ? 18 : 14}
                  aria-invalid={!!documentoError}
                />
                {form.tipo_pessoa === 'pj' && (
                  <Button type="button" variant="outline" onClick={buscarCNPJ} disabled={consultandoCNPJ}>
                    <Search className="h-4 w-4 mr-1" /> {consultandoCNPJ ? 'Buscando...' : 'Buscar'}
                  </Button>
                )}
              </div>
              {documentoError && <p className="text-sm text-destructive">{documentoError}</p>}
            </div>

            <div className="space-y-2">
              <Label>{form.tipo_pessoa === 'pj' ? 'Razão Social' : 'Nome Completo'}</Label>
              <Input value={form.empresa_nome} onChange={e => setField('empresa_nome', form.tipo_pessoa === 'pf' ? formatPersonName(e.target.value) : e.target.value)} placeholder={form.tipo_pessoa === 'pj' ? 'Nome da empresa/cliente' : 'Nome da pessoa'} required />
            </div>

            <div className="space-y-2">
              <Label>Nome do Evento</Label>
              <Input value={form.nome_evento} onChange={e => setField('nome_evento', e.target.value)} placeholder="Ex.: Corrida de Inverno 2025" required />
            </div>

            {form.tipo_pessoa === 'pj' && (
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input value={form.nome_fantasia} onChange={e => setField('nome_fantasia', e.target.value)} placeholder="Nome fantasia" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Data do Evento (passada)</Label>
              <Input type="date" value={form.data_evento} onChange={e => setField('data_evento', e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={e => setField('responsavel', formatPersonName(e.target.value))} placeholder="Nome do responsável" autoCapitalize="words" />
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={e => setField('email', e.target.value.toLowerCase())} placeholder="email@empresa.com" autoCapitalize="none" />
            </div>

            <div className="space-y-2">
              <Label>Cidade do Cliente</Label>
              <Input value={form.cidade_cliente} onChange={e => setField('cidade_cliente', e.target.value)} placeholder="Cidade" />
            </div>

            <div className="space-y-2">
              <Label>UF do Cliente</Label>
              <Input value={form.uf_cliente} onChange={e => setField('uf_cliente', e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" />
            </div>

            <div className="space-y-2">
              <Label>Consultor Responsável</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.consultor}
                onChange={e => setField('consultor', e.target.value)}
                disabled={loadingUsuarios}
              >
                <option value="">{loadingUsuarios ? 'Carregando usuários...' : 'Selecione um consultor'}</option>
                {usuariosAtivos.map(usuario => (
                  <option key={usuario.id} value={usuario.nome}>
                    {usuario.nome} ({usuario.perfil})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center gap-2">
                <input
                  id="local-manual"
                  type="checkbox"
                  checked={form.local_nao_cadastrado}
                  onChange={e => setField('local_nao_cadastrado', e.target.checked)}
                />
                <Label htmlFor="local-manual">Local não cadastrado</Label>
              </div>
            </div>

            {form.local_nao_cadastrado ? (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label>Nome do Local/Parque</Label>
                  <Input value={form.local_nome} onChange={e => setField('local_nome', e.target.value)} placeholder="Ex.: Parque Linear" required />
                </div>

                <div className="space-y-2">
                  <Label>CEP</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={form.local_cep}
                      onChange={e => setField('local_cep', maskCEP(e.target.value))}
                      placeholder="00000-000"
                    />
                    <Button type="button" variant="outline" onClick={buscarCEP} disabled={consultandoCEP}>
                      <SearchCheck className="h-4 w-4 mr-1" /> {consultandoCEP ? 'Buscando...' : 'Buscar CEP'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input ref={numeroInputRef} value={form.local_numero} onChange={e => setField('local_numero', e.target.value)} placeholder="Ex.: 123" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Logradouro</Label>
                  <Input value={form.local_logradouro} onChange={e => setField('local_logradouro', e.target.value)} placeholder="Rua / Avenida" />
                </div>

                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={form.local_complemento} onChange={e => setField('local_complemento', e.target.value)} placeholder="Apto, bloco, referência" />
                </div>

                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={form.local_bairro} onChange={e => setField('local_bairro', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.local_cidade} onChange={e => setField('local_cidade', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input value={form.local_uf} onChange={e => setField('local_uf', e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" />
                </div>

                <div className="space-y-2">
                  <Label>Capacidade Máxima</Label>
                  <Input type="number" min={0} value={form.local_capacidade_maxima} onChange={e => setField('local_capacidade_maxima', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input value={form.local_responsavel} onChange={e => setField('local_responsavel', formatPersonName(e.target.value))} placeholder="Nome do responsável" autoCapitalize="words" />
                </div>

                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.local_whatsapp} onChange={e => setField('local_whatsapp', maskTelefone(e.target.value))} placeholder="(11) 99999-9999" />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label>Local cadastrado</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.local_id}
                    onChange={e => setField('local_id', e.target.value)}
                    disabled={loadingLocais}
                  >
                    <option value="">Selecione um local</option>
                    {listaLocais.map(local => (
                      <option key={local.id} value={local.id}>
                        {local.nome} - {local.cidade}/{local.uf}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Modalidade</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.modalidade}
                    onChange={e => setField('modalidade', e.target.value)}
                  >
                    <option value="Corrida">Corrida</option>
                    <option value="Caminhada">Caminhada</option>
                    <option value="Mista">Mista</option>
                  </select>
            </div>

            <div className="space-y-2">
              <Label>KM</Label>
              <Input value={form.km} onChange={e => setField('km', e.target.value)} placeholder="5" />
            </div>

            <div className="space-y-2">
              <Label>Quantidade de participantes</Label>
              <Input type="number" min={0} value={form.qtd_contratada} onChange={e => setField('qtd_contratada', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Valor total (R$)</Label>
              <Input type="number" min={0} step="0.01" value={form.valor_total} onChange={e => setField('valor_total', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Valor pago (R$)</Label>
              <Input type="number" min={0} step="0.01" value={form.valor_pago} onChange={e => setField('valor_pago', e.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.observacoes}
                onChange={e => setField('observacoes', e.target.value)}
                placeholder="Fonte dos dados, contexto do evento, ajustes manuais, etc."
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Link href="/dashboard/contratos"><Button variant="outline" type="button">Cancelar</Button></Link>
              <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Cadastrar evento retroativo'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
    </div>
  )
}
