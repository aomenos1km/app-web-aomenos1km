'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { insumos, Insumo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RTable, RTableHeader, RTableHead, RTableBody, RTableRow, RTableCell } from '@/components/ui/responsive-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { Plus, Search, Pencil, Trash2, X, Boxes, Lock } from 'lucide-react'

const BLANK: Partial<Insumo> = {
  nome: '',
  categoria: 'Insumo/Produto',
  descricao: '',
  preco_unitario: 0,
  unidade: 'Unidade (Padrão)',
  ativo: true,
}

const CATEGORIA_OPTIONS = [
  { value: 'Insumo/Produto', label: 'Produto' },
  { value: 'Serviço/Staff', label: 'Serviço/Staff' },
]

const UNIDADE_OPTIONS = [
  'Unidade (Padrão)',
  'Passagem (Transp. Público)',
  'Corrida (App/Táxi)',
  'Diária (Serviços/Staff)',
  'Hora (Consultoria/Staff)',
  'Evento (Preço Fechado)',
  'Kit / Conjunto',
  'Par',
  'Metro (Estruturas/Cabos)',
  'Km (Combustível/Logística)',
  'Caixa',
  'Pacote',
]

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function InsumosPage() {
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'
  const [list, setList] = useState<Insumo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Insumo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Insumo | null>(null)
  const [deleteManyOpen, setDeleteManyOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [form, setForm] = useState<Partial<Insumo>>(BLANK)

  function load() {
    setLoading(true)
    insumos
      .listar()
      .then(r => setList(r.data))
      .catch(() => toast.error('Erro ao carregar insumos'))
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

  function openEdit(item: Insumo) {
    if (!canManage(item)) {
      toast.error('Você só pode editar insumos que você mesmo cadastrou')
      return
    }
    setEditing(item)
    setForm({ ...item })
    setOpen(true)
  }

  function canManage(item: Insumo) {
    if (isAdmin) return true
    return Boolean(item.criado_por_user_id && item.criado_por_user_id === user?.id)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    const checked = type === 'checkbox' && 'checked' in e.target ? e.target.checked : false
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }))
  }

  async function onSave() {
    if (!form.nome) {
      toast.error('Nome do insumo é obrigatório')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await insumos.atualizar(editing.id, form)
        toast.success('Insumo atualizado')
      } else {
        await insumos.criar(form)
        toast.success('Insumo criado')
      }
      setOpen(false)
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar insumo')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!deleteTarget) return
    if (!canManage(deleteTarget)) {
      toast.error('Você só pode remover insumos que você mesmo cadastrou')
      setDeleteTarget(null)
      return
    }
    setDeleting(true)
    try {
      await insumos.deletar(deleteTarget.id)
      toast.success('Insumo removido')
      setSelectedIds(prev => prev.filter(id => id !== deleteTarget.id))
      setDeleteTarget(null)
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover insumo')
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
        toast.error('Nenhum insumo selecionado pode ser removido com seu perfil')
        setDeleteManyOpen(false)
        return
      }

      const results = await Promise.allSettled(allowedIds.map(id => insumos.deletar(id)))
      const ok = results.filter(r => r.status === 'fulfilled').length
      const fail = results.length - ok

      if (ok > 0) toast.success(`${ok} insumo(s) removido(s)`)
      if (fail > 0) toast.error(`${fail} insumo(s) não puderam ser removidos`)

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
    `${item.nome} ${item.categoria} ${item.descricao}`.toLowerCase().includes(q.toLowerCase()),
  )
  const visibleIds = filtered.map(item => item.id)
  const manageableVisibleIds = filtered.filter(canManage).map(item => item.id)
  const allVisibleSelected = manageableVisibleIds.length > 0 && manageableVisibleIds.every(id => selectedIds.includes(id))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Insumos</h1>
          <p className="text-sm text-muted-foreground">Catálogo para eventos e orçamentos</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo Insumo
        </Button>
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Você pode criar novos insumos, mas apenas os itens cadastrados por você podem ser editados ou excluídos.
          </span>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar insumo..." value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {selectedIds.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-amber-900">
            {selectedIds.length} insumo(s) selecionado(s)
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
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum insumo encontrado</p>
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
                        aria-label="Selecionar todos os insumos visíveis"
                      />
                    </RTableHead>
                    <RTableHead className="px-4">Insumo</RTableHead>
                    <RTableHead className="w-[240px]">Categoria / Unidade</RTableHead>
                    <RTableHead className="w-[160px] text-center">Preço Unit.</RTableHead>
                    <RTableHead className="w-[140px] text-center">Status</RTableHead>
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
                        <p className="font-medium text-sm">{item.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.descricao || 'Sem descrição'}</p>
                      </RTableCell>
                      <RTableCell>
                        <p className="text-sm">{item.categoria || 'Sem categoria'}</p>
                        <p className="text-xs text-muted-foreground">{item.unidade || 'un'}</p>
                      </RTableCell>
                      <RTableCell className="text-center font-medium">{moeda(item.preco_unitario || 0)}</RTableCell>
                      <RTableCell className="text-center">
                        <Badge variant="outline" className={item.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>
                          {item.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
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
        <DialogContent className="max-w-2xl p-0 overflow-hidden border border-orange-200" showCloseButton={false}>
          <div className="bg-[#f25c05] text-white px-5 py-3 flex items-center justify-between">
            <h2 className="font-bold text-[30px] leading-none flex items-center gap-2">
              <Boxes className="h-5 w-5" /> {editing ? 'Editar item/serviço' : 'Novo item/serviço'}
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
            <section className="rounded-lg border bg-card p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nome" id="nome" className="sm:col-span-2">
                  <Input id="nome" name="nome" value={form.nome ?? ''} onChange={handleChange} />
                </Field>
                <Field label="Categoria" id="categoria">
                  <select
                    id="categoria"
                    name="categoria"
                    value={form.categoria ?? CATEGORIA_OPTIONS[0].value}
                    onChange={handleChange}
                    className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {CATEGORIA_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Unidade" id="unidade">
                  <select
                    id="unidade"
                    name="unidade"
                    value={form.unidade ?? UNIDADE_OPTIONS[0]}
                    onChange={handleChange}
                    className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {UNIDADE_OPTIONS.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Preço unitário" id="preco_unitario">
                  <Input id="preco_unitario" name="preco_unitario" type="number" step="0.01" value={form.preco_unitario ?? 0} onChange={handleChange} />
                </Field>
                <Field label="Ativo" id="ativo">
                  <label className="flex items-center gap-2 h-8">
                    <input id="ativo" name="ativo" type="checkbox" checked={!!form.ativo} onChange={handleChange} />
                    <span className="text-sm">Disponível para uso</span>
                  </label>
                </Field>
                <Field label="Descrição" id="descricao" className="sm:col-span-2">
                  <Input id="descricao" name="descricao" value={form.descricao ?? ''} onChange={handleChange} />
                </Field>
              </div>
            </section>
          </div>

          <div className="border-t bg-card px-4 py-3 sm:px-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Confirmar exclusão"
        description={deleteTarget ? `Deseja excluir o insumo "${deleteTarget.nome}"? Essa ação não poderá ser desfeita.` : ''}
        confirmLabel={deleting ? 'Excluindo...' : 'Confirmar exclusão'}
        confirmDisabled={deleting}
        destructive
        onConfirm={onDelete}
      />

      <ConfirmDialog
        open={deleteManyOpen}
        onOpenChange={setDeleteManyOpen}
        title={`Excluir ${selectedIds.length} insumo(s)?`}
        description="Os itens selecionados serão removidos permanentemente."
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir Selecionados'}
        confirmDisabled={selectedIds.length === 0 || deleting}
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
