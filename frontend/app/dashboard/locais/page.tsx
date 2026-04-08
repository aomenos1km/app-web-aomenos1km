'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { locais, Local } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { RTable, RTableHeader, RTableHead, RTableBody, RTableRow, RTableCell } from '@/components/ui/responsive-table'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, Pencil, X, MapPin, SearchCheck, Trash2, ReceiptText, Lock } from 'lucide-react'

const BLANK: Partial<Local> = {
  codigo: '',
  nome: '',
  tipo: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
  tipo_taxa: 'Fixo',
  taxa_valor: 0,
  minimo_pessoas: 150,
  capacidade_maxima: undefined,
  responsavel: '',
  whatsapp: '',
  ativo: true,
}

const TIPOS_COBRANCA = [
  { value: 'Fixo', label: 'Valor Fixo (Aluguel)' },
  { value: 'Pessoa', label: 'Por Pessoa (Regra de Parques)' },
] as const

function onlyDigits(value: string) {
  return (value || '').replace(/\D/g, '')
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

function parseCurrency(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrencyInput(value: string | number) {
  const numeric = typeof value === 'number' ? value : parseCurrency(value)
  return numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCurrencyDisplay(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function LocaisPage() {
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'
  const [list, setList] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [consultandoCEP, setConsultandoCEP] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Local | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Local | null>(null)
  const [deleteManyOpen, setDeleteManyOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [form, setForm] = useState<Partial<Local>>(BLANK)

  function load() {
    setLoading(true)
    locais
      .listar()
      .then(r => setList(r.data))
      .catch(() => toast.error('Erro ao carregar locais'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => list.some(item => item.id === id)))
  }, [list])

  function openNew() {
    setEditing(null)
    setForm(BLANK)
    setOpen(true)
  }

  function openEdit(item: Local) {
    if (!canManage(item)) {
      toast.error('Você só pode editar locais que você mesmo cadastrou')
      return
    }
    setEditing(item)
    setForm({ ...BLANK, ...item, taxa_valor: item.taxa_valor ?? 0, minimo_pessoas: item.minimo_pessoas ?? 150 })
    setOpen(true)
  }

  function canManage(item: Local) {
    if (isAdmin) return true
    return Boolean(item.criado_por_user_id && item.criado_por_user_id === user?.id)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target
    let nextValue: string | number | boolean | undefined = value

    if (name === 'cep') {
      nextValue = maskCEP(value)
    }
    if (name === 'uf') {
      nextValue = value.toUpperCase().slice(0, 2)
    }
    if (name === 'whatsapp') {
      nextValue = maskTelefone(value)
    }
    if (name === 'taxa_valor') {
      nextValue = value === '' ? 0 : Number(value)
    }
    if (name === 'minimo_pessoas' || name === 'capacidade_maxima') {
      nextValue = value === '' ? undefined : Number(value)
    }

    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : nextValue,
    }))
  }

  async function handleBuscarCEP() {
    const cep = onlyDigits(form.cep || '')
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
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
        complemento: data.complemento || prev.complemento,
      }))
      toast.success('Endereço preenchido pelo CEP')
    } catch {
      toast.error('Erro ao consultar o CEP')
    } finally {
      setConsultandoCEP(false)
    }
  }

  async function onSave() {
    if (!form.nome) {
      toast.error('Nome do local é obrigatório')
      return
    }
    if (!form.tipo_taxa) {
      toast.error('Selecione o modelo de cobrança')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        cep: maskCEP(form.cep ?? ''),
        taxa_valor: parseCurrency(String(form.taxa_valor ?? 0)),
        minimo_pessoas: Number(form.minimo_pessoas ?? 150),
        capacidade_maxima: form.capacidade_maxima ? Number(form.capacidade_maxima) : undefined,
        whatsapp: maskTelefone(form.whatsapp ?? ''),
        ativo: form.ativo ?? true,
      }
      if (editing) {
        await locais.atualizar(editing.id, payload)
        toast.success('Local atualizado')
      } else {
        await locais.criar(payload)
        toast.success('Local criado')
      }
      setOpen(false)
      setForm(BLANK)
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar local')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!deleteTarget) return
    if (!canManage(deleteTarget)) {
      toast.error('Você só pode remover locais que você mesmo cadastrou')
      setDeleteTarget(null)
      return
    }
    setDeleting(true)
    try {
      await locais.deletar(deleteTarget.id)
      toast.success('Local removido')
      setSelectedIds(prev => prev.filter(id => id !== deleteTarget.id))
      setDeleteTarget(null)
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover local')
    } finally {
      setDeleting(false)
    }
  }

  async function onDeleteMany() {
    if (selectedIds.length === 0) return
    setDeleting(true)
    try {
      const ids = [...selectedIds]
      const allowedIds = ids.filter(id => {
        const item = list.find(i => i.id === id)
        return item ? canManage(item) : false
      })
      const blocked = ids.length - allowedIds.length
      if (allowedIds.length === 0) {
        toast.error('Nenhum local selecionado pode ser removido com seu perfil')
        setDeleteManyOpen(false)
        return
      }

      const results = await Promise.allSettled(allowedIds.map(id => locais.deletar(id)))
      const ok = results.filter(r => r.status === 'fulfilled').length
      const fail = results.length - ok

      if (ok > 0) toast.success(`${ok} local(is) removido(s)`)
      if (fail > 0) toast.error(`${fail} local(is) não puderam ser removidos`)

      setDeleteManyOpen(false)
      setSelectedIds(prev => prev.filter(id => !allowedIds.includes(id)))
      load()
      if (blocked > 0) {
        toast.warning(`${ok} removido(s), ${blocked} bloqueado(s) por permissão`)
      }
    } finally {
      setDeleting(false)
    }
  }

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds(prev => {
      if (checked) return Array.from(new Set([...prev, id]))
      return prev.filter(itemId => itemId !== id)
    })
  }

  const filtered = list.filter(item =>
    `${item.nome} ${item.logradouro} ${item.cidade} ${item.uf} ${item.responsavel}`.toLowerCase().includes(q.toLowerCase()),
  )
  const visibleIds = filtered.map(item => item.id)
  const manageableVisibleIds = filtered.filter(canManage).map(item => item.id)
  const allVisibleSelected = manageableVisibleIds.length > 0 && manageableVisibleIds.every(id => selectedIds.includes(id))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Locais & Parques</h1>
          <p className="text-sm text-muted-foreground">Locais que alimentam o gerador de orçamentos e eventos</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo Local
        </Button>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Você pode criar novos locais, mas apenas os itens cadastrados por você podem ser editados ou excluídos.
          </span>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar local..." value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {selectedIds.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-amber-900">
            {selectedIds.length} local(is) selecionado(s)
          </p>
          <Button variant="destructive" onClick={() => setDeleteManyOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir Selecionados
          </Button>
        </div>
      )}

      <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 shadow-none md:gap-4 md:overflow-hidden md:bg-card md:py-4 md:ring-1 md:shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum local encontrado</p>
          ) : (
            <div className="md:overflow-x-auto">
              <RTable>
                <RTableHeader>
                  <RTableRow>
                    <RTableHead className="w-[52px] px-4 text-center" mobileLabel="">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#f25c05]"
                        checked={allVisibleSelected}
                        onChange={e => setSelectedIds(e.target.checked ? manageableVisibleIds : [])}
                        aria-label="Selecionar todos os locais visíveis"
                      />
                    </RTableHead>
                    <RTableHead className="px-4">Local</RTableHead>
                    <RTableHead className="w-[220px]">Taxa</RTableHead>
                    <RTableHead className="w-[160px]">Capacidade</RTableHead>
                    <RTableHead className="w-[220px]">Responsável</RTableHead>
                    <RTableHead className="w-[130px] text-center px-4" mobileLabel="">Ações</RTableHead>
                  </RTableRow>
                </RTableHeader>
                <RTableBody>
                  {filtered.map(item => (
                    <RTableRow key={item.id} selected={selectedIds.includes(item.id)}>
                      <RTableCell className="px-4 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#f25c05]"
                          checked={selectedIds.includes(item.id)}
                          disabled={!canManage(item)}
                          onChange={e => toggleSelection(item.id, e.target.checked)}
                          aria-label={`Selecionar ${item.nome}`}
                        />
                      </RTableCell>
                      <RTableCell className="px-4">
                        <p className="font-medium text-sm text-[#f25c05]">{item.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          <MapPin className="inline h-3 w-3 mr-1" />
                          {[item.logradouro, item.numero].filter(Boolean).join(', ') || 'Endereço não informado'}
                        </p>
                      </RTableCell>
                      <RTableCell>
                        <p className="text-sm font-medium text-emerald-700">{formatCurrencyDisplay(item.taxa_valor || 0)}</p>
                        <p className="text-xs text-muted-foreground">
                          / {item.tipo_taxa === 'Pessoa' ? 'por pessoa' : 'por fixo'}
                        </p>
                      </RTableCell>
                      <RTableCell>
                        <p className="text-sm">{item.capacidade_maxima ? String(item.capacidade_maxima) : '-'}</p>
                      </RTableCell>
                      <RTableCell>
                        <p className="text-sm">{item.responsavel || '-'}</p>
                        <p className="text-xs text-muted-foreground">{item.whatsapp || item.cidade || '-'}</p>
                      </RTableCell>
                      <RTableCell className="px-4">
                        <div className="flex items-center justify-center gap-1">
                          {canManage(item) ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <span className="inline-flex items-center text-zinc-500" title="Ações disponíveis apenas para o autor do item">
                              <Lock className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </RTableCell>
                    </RTableRow>
                  ))}
                </RTableBody>
              </RTable>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[980px] p-0 overflow-hidden border border-orange-200" showCloseButton={false}>
          <div className="bg-[#f25c05] text-white px-5 py-3 flex items-center justify-between">
            <h2 className="font-bold text-[30px] leading-none flex items-center gap-2">
              <MapPin className="h-5 w-5" /> Ficha do Local / Parque
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/90 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[82vh] overflow-y-auto p-4 sm:p-5 space-y-4 bg-background">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <Field label="Nome do Local/Parque" id="nome" className="sm:col-span-8">
                <Input id="nome" name="nome" value={form.nome ?? ''} onChange={handleChange} placeholder="Ex: Parque do Ibirapuera" />
              </Field>
              <Field label="CEP" id="cep" className="sm:col-span-4">
                <div className="flex gap-2">
                  <Input id="cep" name="cep" value={form.cep ?? ''} onChange={handleChange} placeholder="00000-000" />
                  <Button type="button" variant="outline" onClick={handleBuscarCEP} disabled={consultandoCEP}>
                    <SearchCheck className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
            </div>

            <section className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase border-b pb-2">Localização</h3>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <Field label="Logradouro (Rua/Av)" id="logradouro" className="sm:col-span-7">
                  <Input id="logradouro" name="logradouro" value={form.logradouro ?? ''} onChange={handleChange} />
                </Field>
                <Field label="Número" id="numero" className="sm:col-span-2">
                  <Input id="numero" name="numero" value={form.numero ?? ''} onChange={handleChange} placeholder="S/N" />
                </Field>
                <Field label="Complemento" id="complemento" className="sm:col-span-3">
                  <Input id="complemento" name="complemento" value={form.complemento ?? ''} onChange={handleChange} placeholder="Apto, Bloco..." />
                </Field>
                <Field label="Bairro" id="bairro" className="sm:col-span-5">
                  <Input id="bairro" name="bairro" value={form.bairro ?? ''} onChange={handleChange} />
                </Field>
                <Field label="Cidade" id="cidade" className="sm:col-span-4">
                  <Input id="cidade" name="cidade" value={form.cidade ?? ''} onChange={handleChange} />
                </Field>
                <Field label="UF" id="uf" className="sm:col-span-3">
                  <Input id="uf" name="uf" value={form.uf ?? ''} onChange={handleChange} maxLength={2} />
                </Field>
              </div>
            </section>

            <section className="rounded-lg border border-l-4 border-l-blue-500 bg-card p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#f25c05] uppercase">Configuração de Taxas Inteligentes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Modelo de Cobrança" id="tipo_taxa">
                  <Select
                    value={form.tipo_taxa ?? 'Fixo'}
                    onValueChange={value => setForm(prev => ({ ...prev, tipo_taxa: value ?? 'Fixo' }))}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_COBRANCA.map(item => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Valor da Taxa (R$)" id="taxa_valor">
                  <Input id="taxa_valor" name="taxa_valor" type="number" min={0} step={0.01} value={Number(form.taxa_valor ?? 0)} onChange={handleChange} placeholder="0.00" />
                </Field>
              </div>
              <Field label="Gatilho de Isenção" id="minimo_pessoas">
                <div className="grid grid-cols-[1fr_120px_auto] items-center rounded-lg border overflow-hidden">
                  <div className="bg-muted/60 px-3 py-2 text-sm text-muted-foreground">Cobrar taxa apenas se o evento tiver mais de</div>
                  <Input
                    id="minimo_pessoas"
                    name="minimo_pessoas"
                    type="number"
                    value={form.minimo_pessoas ?? 150}
                    onChange={handleChange}
                    className="rounded-none border-0 text-center font-bold text-red-500 focus-visible:ring-0"
                  />
                  <div className="bg-muted/60 px-3 py-2 text-sm">pessoas</div>
                </div>
              </Field>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Capacidade Máxima" id="capacidade_maxima">
                <Input id="capacidade_maxima" name="capacidade_maxima" type="number" value={form.capacidade_maxima ?? ''} onChange={handleChange} />
              </Field>
              <Field label="Responsável" id="responsavel">
                <Input id="responsavel" name="responsavel" value={form.responsavel ?? ''} onChange={handleChange} />
              </Field>
              <Field label="WhatsApp" id="whatsapp">
                <Input id="whatsapp" name="whatsapp" value={form.whatsapp ?? ''} onChange={handleChange} />
              </Field>
            </div>
          </div>

          <div className="border-t bg-card px-4 py-3 sm:px-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving} className="bg-[#f25c05] hover:bg-[#d94f00]">
              <ReceiptText className="h-4 w-4 mr-1" />
              {saving ? 'Salvando...' : 'Salvar Local no Sistema'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={openState => !openState && setDeleteTarget(null)}
        title="Excluir local?"
        description={deleteTarget ? `Você está removendo ${deleteTarget.nome}. Essa ação apagará o cadastro do local.` : ''}
        confirmLabel={deleting ? 'Excluindo...' : 'Sim, excluir permanentemente'}
        cancelLabel="Cancelar"
        confirmDisabled={deleting}
        destructive
        onConfirm={onDelete}
      />

      <ConfirmDialog
        open={deleteManyOpen}
        onOpenChange={setDeleteManyOpen}
        title={`Excluir ${selectedIds.length} local(is)?`}
        description="A exclusão em lote removerá os locais selecionados permanentemente."
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir Selecionados'}
        confirmDisabled={selectedIds.length === 0 || deleting}
        cancelLabel="Cancelar"
        destructive
        onConfirm={onDeleteMany}
      />
    </div>
  )
}

function Field({
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
