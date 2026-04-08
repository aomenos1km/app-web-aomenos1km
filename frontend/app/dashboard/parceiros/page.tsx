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
import { Handshake, Pencil, Plus, RefreshCcw, Search, Trash2, X, Lock } from 'lucide-react'

type Parceiro = {
  id: string
  nome: string
  especialidade: string
  cacheValor: string
  cacheUnidade: string
  telefone: string
  email: string
  createdById?: string
  createdByNome?: string
}

const STORAGE_KEY = 'aomenos1km:parceiros'

const ESPECIALIDADE_OPTIONS = [
  'Professor',
  'Personal Trainer',
  'Nutricionista',
  'Fisioterapeuta',
  'Staff Geral',
  'Fotógrafo',
  'Videomaker',
]

const CACHE_UNIDADE_OPTIONS = ['Diária', 'Hora', 'Evento']

const BLANK: Partial<Parceiro> = {
  nome: '',
  especialidade: ESPECIALIDADE_OPTIONS[0],
  cacheValor: '0,00',
  cacheUnidade: CACHE_UNIDADE_OPTIONS[0],
  telefone: '',
  email: '',
}

function readParceiros(): Parceiro[] {
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

function writeParceiros(data: Parceiro[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
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

function formatMoney(value: string) {
  const digits = digitsOnly(value)
  if (!digits) return '0,00'

  const intValue = Number(digits)
  const normalized = (intValue / 100).toFixed(2)
  const [intPart, decimalPart] = normalized.split('.')

  return `${Number(intPart).toLocaleString('pt-BR')},${decimalPart}`
}

function createId() {
  return `PAR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export default function ParceirosPage() {
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'
  const [list, setList] = useState<Parceiro[]>([])
    function canManage(item: Parceiro) {
      if (isAdmin) return true
      if (!item.createdById) return false
      return item.createdById === user?.id
    }

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Parceiro | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Parceiro | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [form, setForm] = useState<Partial<Parceiro>>(BLANK)

  function load() {
    setLoading(true)
    setList(readParceiros())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => list.some(item => item.id === id)))
  }, [list])

  function persist(next: Parceiro[]) {
    writeParceiros(next)
    setList(next)
  }

  function openNew() {
    setEditing(null)
    setForm(BLANK)
    setOpen(true)
  }

  function openEdit(item: Parceiro) {
    if (!canManage(item)) {
      toast.error('Você só pode editar parceiros que você mesmo cadastrou')
      return
    }
    setEditing(item)
    setForm({ ...item })
    setOpen(true)
  }

  function closeModal() {
    setOpen(false)
    setEditing(null)
    setForm(BLANK)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target

    let nextValue = value
    if (name === 'telefone') nextValue = formatTelefone(value)
    if (name === 'cacheValor') nextValue = formatMoney(value)

    setForm(prev => ({
      ...prev,
      [name]: nextValue,
    }))
  }

  function onSave() {
    const nome = (form.nome || '').trim()
    if (!nome) {
      toast.error('Nome completo é obrigatório')
      return
    }

    setSaving(true)
    try {
      const payload: Parceiro = {
        id: editing?.id || createId(),
        nome,
        especialidade: form.especialidade || ESPECIALIDADE_OPTIONS[0],
        cacheValor: form.cacheValor || '0,00',
        cacheUnidade: form.cacheUnidade || CACHE_UNIDADE_OPTIONS[0],
        telefone: form.telefone || '',
        email: (form.email || '').trim(),
        createdById: editing?.createdById || user?.id,
        createdByNome: editing?.createdByNome || user?.nome,
      }

      const next = editing
        ? list.map(item => (item.id === editing.id ? payload : item))
        : [payload, ...list]

      persist(next)
      toast.success(editing ? 'Parceiro atualizado' : 'Parceiro criado')
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  function onDelete() {
    if (!deleteTarget) return
    if (!canManage(deleteTarget)) {
      toast.error('Você só pode excluir parceiros que você mesmo cadastrou')
      setDeleteTarget(null)
      return
    }

    const next = list.filter(item => item.id !== deleteTarget.id)
    persist(next)
    setSelectedIds(prev => prev.filter(id => id !== deleteTarget.id))
    setDeleteTarget(null)
    toast.success('Parceiro removido')
  }

  function onBulkDelete() {
    if (selectedIds.length === 0) return

    const selected = list.filter(item => selectedIds.includes(item.id))
    const allowedIds = selected.filter(canManage).map(item => item.id)
    const blocked = selected.length - allowedIds.length
    if (allowedIds.length === 0) {
      toast.error('Nenhum parceiro selecionado pode ser removido com seu perfil')
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
    toast.success(allowedIds.length === 1 ? 'Parceiro removido' : 'Parceiros removidos')
  }

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds(prev => {
      if (checked) return Array.from(new Set([...prev, id]))
      return prev.filter(itemId => itemId !== id)
    })
  }

  const filtered = list.filter(item =>
    `${item.nome} ${item.especialidade} ${item.cacheValor} ${item.cacheUnidade} ${item.telefone} ${item.email}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  )

  const visibleIds = filtered.map(item => item.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id))
  const selectedNames = list.filter(item => selectedIds.includes(item.id)).map(item => item.nome)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Parceiros & Staff</h1>
          <p className="text-sm text-muted-foreground">
            {list.length === 0 ? 'Nenhum parceiro cadastrado' : `${list.length} cadastrado${list.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} aria-label="Atualizar lista">
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo Parceiro
          </Button>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar parceiro..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Você pode criar novos parceiros, mas apenas os itens cadastrados por você podem ser editados ou excluídos.
          </span>
        </div>
      )}

      {selectedIds.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-amber-900">
            {selectedIds.length} parceiro(s) selecionado(s)
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
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum parceiro encontrado</p>
          ) : (
            <div className="md:overflow-x-auto">
              <RTable>
                <RTableHeader>
                  <RTableRow>
                    <RTableHead className="w-[48px]" mobileLabel="">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#f25c05]"
                        checked={allVisibleSelected}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])))
                          } else {
                            setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)))
                          }
                        }}
                        aria-label="Selecionar todos"
                      />
                    </RTableHead>
                    <RTableHead>Nome</RTableHead>
                    <RTableHead className="w-[240px]">Especialidade</RTableHead>
                    <RTableHead className="w-[220px]">Cachê padrão</RTableHead>
                    <RTableHead className="w-[130px] text-center" mobileLabel="">Ações</RTableHead>
                  </RTableRow>
                </RTableHeader>
                <RTableBody>
                  {filtered.map(item => (
                    <RTableRow key={item.id} selected={selectedIds.includes(item.id)}>
                      <RTableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#f25c05]"
                          checked={selectedIds.includes(item.id)}
                          onChange={e => toggleSelection(item.id, e.target.checked)}
                          aria-label={`Selecionar ${item.nome}`}
                        />
                      </RTableCell>
                      <RTableCell className="font-semibold">{item.nome}</RTableCell>
                      <RTableCell>{item.especialidade}</RTableCell>
                      <RTableCell>{`R$ ${item.cacheValor} / ${item.cacheUnidade}`}</RTableCell>
                      <RTableCell>
                        <div className="flex items-center justify-center gap-2">
                          {canManage(item) ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(item)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(item)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
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

      <Dialog open={open} onOpenChange={state => (state ? setOpen(true) : closeModal())}>
        <DialogContent showCloseButton={false} className="max-w-3xl p-0 overflow-hidden gap-0">
          <div className="bg-[#f25c05] px-5 py-3 text-white flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Handshake className="h-5 w-5" />
              {editing ? 'Editar parceiro/staff' : 'Novo parceiro/staff'}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
              onClick={closeModal}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="bg-background p-4 max-h-[80vh] overflow-y-auto">
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  name="nome"
                  value={form.nome || ''}
                  onChange={handleChange}
                  placeholder="Ex: Dênis Almeida"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="especialidade">Especialidade</Label>
                  <select
                    id="especialidade"
                    name="especialidade"
                    value={form.especialidade || ESPECIALIDADE_OPTIONS[0]}
                    onChange={handleChange}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {ESPECIALIDADE_OPTIONS.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cacheValor">Cachê Padrão (R$)</Label>
                  <div className="grid grid-cols-[1fr_120px] gap-2">
                    <Input
                      id="cacheValor"
                      name="cacheValor"
                      value={form.cacheValor || '0,00'}
                      onChange={handleChange}
                      placeholder="0,00"
                    />
                    <select
                      id="cacheUnidade"
                      name="cacheUnidade"
                      value={form.cacheUnidade || CACHE_UNIDADE_OPTIONS[0]}
                      onChange={handleChange}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {CACHE_UNIDADE_OPTIONS.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone / Zap</Label>
                  <Input
                    id="telefone"
                    name="telefone"
                    value={form.telefone || ''}
                    onChange={handleChange}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email || ''}
                    onChange={handleChange}
                    placeholder="nome@empresa.com"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t bg-card px-4 py-3 flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Parceiro'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={state => !state && setDeleteTarget(null)}
        title="Excluir Parceiro?"
        description={
          deleteTarget
            ? `Você está removendo: ${deleteTarget.nome}. Esta ação não poderá ser desfeita.`
            : 'Você está removendo um parceiro. Esta ação não poderá ser desfeita.'
        }
        confirmLabel="Sim, excluir permanentemente"
        cancelLabel="Cancelar"
        destructive
        onConfirm={onDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Excluir ${selectedIds.length} parceiro${selectedIds.length > 1 ? 's' : ''}?`}
        description={
          selectedIds.length > 0
            ? `Você selecionou ${selectedIds.length} parceiro${selectedIds.length > 1 ? 's' : ''}: ${selectedNames.join(', ')}. Esta ação não poderá ser desfeita.`
            : 'Nenhum parceiro selecionado.'
        }
        confirmLabel="Sim, excluir selecionados"
        cancelLabel="Cancelar"
        destructive
        onConfirm={onBulkDelete}
      />
    </div>
  )
}
