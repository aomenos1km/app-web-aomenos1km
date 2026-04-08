'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { RTable, RTableHeader, RTableHead, RTableBody, RTableRow, RTableCell } from '@/components/ui/responsive-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { Plus, Search, Pencil, Trash2, X, Truck, RefreshCcw, Lock } from 'lucide-react'

type Fornecedor = {
  id: string
  nome: string
  categoria: string
  documento: string
  contato: string
  telefone: string
  email: string
  createdById?: string
  createdByNome?: string
}

const STORAGE_KEY = 'aomenos1km:fornecedores'

const CATEGORIA_OPTIONS = [
  'Geral',
  'Alimentos/Bebidas',
  'Confecção',
  'Medalhas/Troféus',
  'Estrutura/Locação',
]

const BLANK: Partial<Fornecedor> = {
  nome: '',
  categoria: 'Geral',
  documento: '',
  contato: '',
  telefone: '',
  email: '',
}

function readFornecedores(): Fornecedor[] {
  if (typeof window === 'undefined') return []

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeFornecedores(data: Fornecedor[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function formatDocumento(value: string) {
  const digits = digitsOnly(value).slice(0, 14)

  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function formatTelefone(value: string) {
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

function isRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value)
}

function validarCPF(value: string) {
  const digits = digitsOnly(value)
  if (digits.length !== 11 || isRepeatedDigits(digits)) return false

  let soma = 0
  for (let index = 0; index < 9; index += 1) {
    soma += Number(digits[index]) * (10 - index)
  }

  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== Number(digits[9])) return false

  soma = 0
  for (let index = 0; index < 10; index += 1) {
    soma += Number(digits[index]) * (11 - index)
  }

  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  return resto === Number(digits[10])
}

function validarCNPJ(value: string) {
  const digits = digitsOnly(value)
  if (digits.length !== 14 || isRepeatedDigits(digits)) return false

  const calc = (base: string, factors: number[]) => {
    const total = base
      .split('')
      .reduce((sum, digit, index) => sum + Number(digit) * factors[index], 0)
    const remainder = total % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const first = calc(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = calc(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])

  return first === Number(digits[12]) && second === Number(digits[13])
}

function getDocumentoError(value: string, touched: boolean) {
  if (!touched) return ''

  const digits = digitsOnly(value)
  if (!digits) return ''
  if (digits.length !== 11 && digits.length !== 14) return 'Documento incompleto'
  if (digits.length === 11 && !validarCPF(digits)) return 'CPF inválido'
  if (digits.length === 14 && !validarCNPJ(digits)) return 'CNPJ inválido'
  return ''
}

function createId() {
  return `FOR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export default function FornecedoresPage() {
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'
  const [list, setList] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Fornecedor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Fornecedor | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [documentTouched, setDocumentTouched] = useState(false)
  const [form, setForm] = useState<Partial<Fornecedor>>(BLANK)

  function load() {
    setLoading(true)
    setList(readFornecedores())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function persist(next: Fornecedor[]) {
    writeFornecedores(next)
    setList(next)
  }

  function openNew() {
    setEditing(null)
    setForm(BLANK)
    setDocumentTouched(false)
    setOpen(true)
  }

  function openEdit(item: Fornecedor) {
    if (!canManage(item)) {
      toast.error('Você só pode editar fornecedores que você mesmo cadastrou')
      return
    }
    setEditing(item)
    setForm({ ...item })
    setDocumentTouched(false)
    setOpen(true)
  }

  function canManage(item: Fornecedor) {
    if (isAdmin) return true
    if (!item.createdById) return false
    return item.createdById === user?.id
  }

  function closeModal() {
    setOpen(false)
    setEditing(null)
    setForm(BLANK)
    setDocumentTouched(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target

    let nextValue = value
    if (name === 'documento') nextValue = formatDocumento(value)
    if (name === 'telefone') nextValue = formatTelefone(value)

    setForm(prev => ({
      ...prev,
      [name]: nextValue,
    }))
  }

  function onSave() {
    const nome = (form.nome || '').trim()
    const documento = form.documento || ''
    const documentoError = getDocumentoError(documento, true)

    setDocumentTouched(true)

    if (!nome) {
      toast.error('Nome fantasia / empresa é obrigatório')
      return
    }

    if (documentoError) {
      toast.error(documentoError)
      return
    }

    setSaving(true)
    try {
      const payload: Fornecedor = {
        id: editing?.id || createId(),
        nome,
        categoria: form.categoria || CATEGORIA_OPTIONS[0],
        documento,
        contato: (form.contato || '').trim(),
        telefone: form.telefone || '',
        email: (form.email || '').trim(),
        createdById: editing?.createdById || user?.id,
        createdByNome: editing?.createdByNome || user?.nome,
      }

      const next = editing
        ? list.map(item => (item.id === editing.id ? payload : item))
        : [payload, ...list]

      persist(next)
      toast.success(editing ? 'Fornecedor atualizado' : 'Fornecedor criado')
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  function onDelete() {
    if (!deleteTarget) return
    if (!canManage(deleteTarget)) {
      toast.error('Você só pode excluir fornecedores que você mesmo cadastrou')
      setDeleteTarget(null)
      return
    }

    const next = list.filter(item => item.id !== deleteTarget.id)
    persist(next)
    setSelectedIds(prev => prev.filter(id => id !== deleteTarget.id))
    setDeleteTarget(null)
    toast.success('Fornecedor removido')
  }

  function onBulkDelete() {
    if (selectedIds.length === 0) return

    const selected = list.filter(item => selectedIds.includes(item.id))
    const allowedIds = selected.filter(canManage).map(item => item.id)
    const blocked = selected.length - allowedIds.length
    if (allowedIds.length === 0) {
      toast.error('Nenhum fornecedor selecionado pode ser removido com seu perfil')
      setBulkDeleteOpen(false)
      return
    }

    const next = list.filter(item => !allowedIds.includes(item.id))
    persist(next)
    setSelectedIds(prev => prev.filter(id => !allowedIds.includes(id)))
    setBulkDeleteOpen(false)
    if (blocked > 0) {
      toast.warning(`${allowedIds.length} removido(s), ${blocked} bloqueado(s) por permissão`)
      return
    }
    toast.success(allowedIds.length === 1 ? 'Fornecedor removido' : 'Fornecedores removidos')
  }

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds(prev => {
      if (checked) return Array.from(new Set([...prev, id]))
      return prev.filter(itemId => itemId !== id)
    })
  }

  const filtered = list.filter(item =>
    `${item.nome} ${item.categoria} ${item.documento} ${item.contato} ${item.telefone} ${item.email}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  )

  const visibleIds = filtered.map(item => item.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id))
  const documentError = getDocumentoError(form.documento || '', documentTouched)
  const selectedNames = list.filter(item => selectedIds.includes(item.id)).map(item => item.nome)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            {list.length === 0 ? 'Nenhum fornecedor cadastrado' : `${list.length} cadastrado${list.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} aria-label="Atualizar lista">
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo Fornecedor
          </Button>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar fornecedor..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Você pode criar novos fornecedores, mas apenas os itens cadastrados por você podem ser editados ou excluídos.
          </span>
        </div>
      )}

      {selectedIds.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium text-amber-950">
            {selectedIds.length} fornecedor{selectedIds.length > 1 ? 'es selecionados' : ' selecionado'}
          </p>
          <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir selecionados
          </Button>
        </div>
      ) : null}

      <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 shadow-none md:gap-4 md:overflow-hidden md:bg-card md:py-4 md:ring-1 md:shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum fornecedor encontrado</p>
          ) : (
            <RTable>
              <RTableHeader>
                <RTableRow>
                  <RTableHead mobileLabel="" className="w-[52px] px-4 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={e => setSelectedIds(e.target.checked ? visibleIds : [])}
                      aria-label="Selecionar todos os fornecedores visíveis"
                    />
                  </RTableHead>
                  <RTableHead className="px-4">Empresa / Nome</RTableHead>
                  <RTableHead className="w-[220px]">Categoria</RTableHead>
                  <RTableHead className="w-[260px]">Contato</RTableHead>
                  <RTableHead mobileLabel="" className="w-[130px] text-center px-4">Ações</RTableHead>
                </RTableRow>
              </RTableHeader>
              <RTableBody>
                {filtered.map(item => (
                  <RTableRow key={item.id} data-state={selectedIds.includes(item.id) ? 'selected' : undefined}>
                    <RTableCell className="px-4 text-center align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={e => toggleSelection(item.id, e.target.checked)}
                        aria-label={`Selecionar ${item.nome}`}
                      />
                    </RTableCell>
                    <RTableCell className="px-4">
                      <p className="font-medium text-sm">{item.nome}</p>
                      <p className="text-xs text-muted-foreground">{item.documento || 'Documento não informado'}</p>
                    </RTableCell>
                    <RTableCell>
                      <p className="text-sm">{item.categoria}</p>
                    </RTableCell>
                    <RTableCell>
                      <p className="text-sm">{item.contato || 'Contato não informado'}</p>
                      {item.telefone || item.email ? (
                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {item.telefone ? <p>{item.telefone}</p> : null}
                          {item.email ? <p>{item.email}</p> : null}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem telefone ou e-mail</p>
                      )}
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
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={nextOpen => (nextOpen ? setOpen(true) : closeModal())}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border border-orange-200" showCloseButton={false}>
          <div className="bg-[#f25c05] text-white px-5 py-3 flex items-center justify-between">
            <h2 className="font-bold text-[30px] leading-none flex items-center gap-2">
              <Truck className="h-5 w-5" /> {editing ? 'Editar fornecedor' : 'Novo fornecedor'}
            </h2>
            <button
              type="button"
              onClick={closeModal}
              className="text-white/90 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[82vh] overflow-y-auto p-4 sm:p-5 space-y-4 bg-background">
            <section className="rounded-lg border bg-card p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nome Fantasia / Empresa" id="nome" className="sm:col-span-2">
                  <Input
                    id="nome"
                    name="nome"
                    value={form.nome ?? ''}
                    onChange={handleChange}
                    placeholder="Ex: Distribuidora Água Pura"
                  />
                </Field>

                <Field label="Categoria" id="categoria">
                  <select
                    id="categoria"
                    name="categoria"
                    value={form.categoria ?? CATEGORIA_OPTIONS[0]}
                    onChange={handleChange}
                    className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {CATEGORIA_OPTIONS.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="CNPJ / CPF" id="documento">
                  <Input
                    id="documento"
                    name="documento"
                    value={form.documento ?? ''}
                    onChange={handleChange}
                    onBlur={() => setDocumentTouched(true)}
                    placeholder="00.000.000/0000-00"
                  />
                  {documentError ? <p className="text-xs font-medium text-red-600">{documentError}</p> : null}
                </Field>

                <Field label="Contato (Nome do Vendedor)" id="contato" className="sm:col-span-2">
                  <Input
                    id="contato"
                    name="contato"
                    value={form.contato ?? ''}
                    onChange={handleChange}
                    placeholder="Ex: João Silva"
                  />
                </Field>

                <Field label="Telefone / Zap" id="telefone">
                  <Input
                    id="telefone"
                    name="telefone"
                    value={form.telefone ?? ''}
                    onChange={handleChange}
                    placeholder="(11) 99999-9999"
                  />
                </Field>

                <Field label="E-mail" id="email">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email ?? ''}
                    onChange={handleChange}
                  />
                </Field>
              </div>
            </section>
          </div>

          <div className="border-t bg-card px-4 py-3 sm:px-5 flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Fornecedor'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={openState => !openState && setDeleteTarget(null)}
        title="Excluir fornecedor?"
        description={deleteTarget ? `Você está removendo ${deleteTarget.nome}. Essa ação apagará o cadastro do fornecedor.` : ''}
        confirmLabel="Sim, excluir permanentemente"
        cancelLabel="Cancelar"
        destructive
        onConfirm={onDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Excluir ${selectedIds.length} fornecedor${selectedIds.length > 1 ? 'es' : ''}?`}
        description="Os fornecedores selecionados serão removidos permanentemente. Essa ação não poderá ser desfeita."
        confirmLabel="Excluir selecionados"
        cancelLabel="Cancelar"
        destructive
        onConfirm={onBulkDelete}
      >
        {selectedNames.length > 0 ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-900">
            <p className="font-medium mb-1">Itens selecionados</p>
            <p>{selectedNames.slice(0, 3).join(', ')}{selectedNames.length > 3 ? ` e mais ${selectedNames.length - 3}` : ''}</p>
          </div>
        ) : null}
      </ConfirmDialog>
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
