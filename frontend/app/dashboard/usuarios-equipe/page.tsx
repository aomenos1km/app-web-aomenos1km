'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, Users, Lock } from 'lucide-react'
import { usuariosEquipe, type UsuarioEquipe, type UsuarioEquipeInput } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RTable, RTableBody, RTableCell, RTableHead, RTableHeader, RTableRow } from '@/components/ui/responsive-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type FormState = {
  id?: string
  nome: string
  login: string
  email: string
  senha: string
  perfil: 'Admin' | 'Consultor' | 'Visualizador'
  ativo: boolean
  comissao_percent: number
}

const formInicial: FormState = {
  nome: '',
  login: '',
  email: '',
  senha: '',
  perfil: 'Consultor',
  ativo: true,
  comissao_percent: 0,
}

export default function UsuariosEquipePage() {
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'
  const isConsultor = user?.perfil === 'Consultor'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lista, setLista] = useState<UsuarioEquipe[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(formInicial)

  const editando = Boolean(form.id)

  const admins = useMemo(() => lista.filter(u => u.perfil === 'Admin'), [lista])
  const equipe = useMemo(() => lista.filter(u => u.perfil !== 'Admin'), [lista])

  async function carregarUsuarios() {
    setLoading(true)
    try {
      const res = await usuariosEquipe.listar()
      setLista(res.data || [])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregarUsuarios()
  }, [])

  function abrirNovoUsuario() {
    if (!isAdmin) {
      toast.error('Somente administradores podem criar usuários')
      return
    }
    setForm(formInicial)
    setModalOpen(true)
  }

  function abrirEdicao(usuario: UsuarioEquipe) {
    // Consultores só podem editar a si próprios
    if (isConsultor && usuario.id !== user?.id) {
      toast.error('Você só pode editar sua própria conta')
      return
    }
    setForm({
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      email: usuario.email || '',
      senha: '',
      perfil: usuario.perfil,
      ativo: usuario.ativo,
      comissao_percent: Number(usuario.comissao_percent || 0),
    })
    setModalOpen(true)
  }

  async function salvarUsuario(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin && !isConsultor) {
      toast.error('Você não tem permissão para gerenciar usuários')
      return
    }

    // Consultores não podem criar, apenas editar a si próprios
    if (!editando && !isAdmin) {
      toast.error('Somente administradores podem criar usuários')
      return
    }

    if (!form.nome.trim() || !form.login.trim()) {
      toast.error('Nome e login são obrigatórios')
      return
    }

    if (!editando && form.senha.trim().length < 6) {
      toast.error('Senha deve ter ao menos 6 caracteres')
      return
    }

    if (form.comissao_percent < 0 || form.comissao_percent > 100) {
      toast.error('Comissão deve estar entre 0 e 100')
      return
    }

    setSaving(true)
    try {
      if (editando && form.id) {
        const payload: UsuarioEquipeInput = {
          nome: form.nome.trim(),
          login: form.login.trim(),
          senha: form.senha.trim() || undefined,
          email: form.email.trim(),
          perfil: form.perfil,
          ativo: form.ativo,
          comissao_percent: form.comissao_percent,
        }
        await usuariosEquipe.atualizar(form.id, payload)
        toast.success('Usuário atualizado com sucesso')
      } else {
        await usuariosEquipe.criar({
          nome: form.nome.trim(),
          login: form.login.trim(),
          senha: form.senha.trim(),
          email: form.email.trim(),
          perfil: form.perfil,
          ativo: form.ativo,
          comissao_percent: form.comissao_percent,
        })
        toast.success('Usuário criado com sucesso')
      }

      setModalOpen(false)
      setForm(formInicial)
      await carregarUsuarios()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar usuário')
    } finally {
      setSaving(false)
    }
  }

  async function deletarUsuario() {
    if (!deleteId) return
    // Apenas Admins podem deletar usuários
    if (!isAdmin) {
      toast.error('Apenas administradores podem excluir usuários')
      return
    }
    // Ninguém pode deletar sua própria conta
    if (deleteId === user?.id) {
      toast.error('Você não pode deletar sua própria conta')
      return
    }

    try {
      await usuariosEquipe.deletar(deleteId)
      toast.success('Usuário removido com sucesso')
      setDeleteId(null)
      await carregarUsuarios()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover usuário')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-5 w-5 text-[#f25c05]" /> Controle de Usuários</h1>
          <p className="text-sm text-muted-foreground">
            {isConsultor ? 'Gerencie sua conta.' : 'Gerencie acessos, perfis e status da equipe.'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={abrirNovoUsuario} className="bg-[#f25c05] hover:bg-[#d84f00] text-white">
            <Plus className="h-4 w-4" /> Novo Usuário
          </Button>
        )}
      </div>

      {/* Mostrar seção de Administradores apenas para Admins */}
      {isAdmin && (
        <UserGroupCard
          titulo="Administradores"
          usuarios={admins}
          userIdLogado={user?.id}
          onEditar={abrirEdicao}
          onExcluir={setDeleteId}
          loading={loading}
          mostrarSensivel={true}
          perfilUserLogado="Admin"
        />
      )}

      <UserGroupCard
        titulo="Equipe de Vendas"
        usuarios={equipe}
        userIdLogado={user?.id}
        onEditar={abrirEdicao}
        onExcluir={setDeleteId}
        loading={loading}
        mostrarSensivel={true}
        perfilUserLogado={user?.perfil || 'Consultor'}
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? 'Gerenciar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={salvarUsuario}>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input id="nome" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="login">Login de Acesso</Label>
                <Input id="login" value={form.login} onChange={e => setForm(p => ({ ...p, login: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder={editando ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}
                  value={form.senha}
                  onChange={e => setForm(p => ({ ...p, senha: e.target.value }))}
                  required={!editando}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail de Contato</Label>
              <Input id="email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="perfil">Perfil de Acesso</Label>
                <select
                  id="perfil"
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  value={form.perfil}
                  onChange={e => setForm(p => ({ ...p, perfil: e.target.value as FormState['perfil'] }))}
                  disabled={isConsultor && editando && form.id === user?.id}
                >
                  <option value="Admin">Administrador</option>
                  <option value="Consultor">Consultor</option>
                  <option value="Visualizador">Visualizador</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comissao">Comissão (%)</Label>
                <div className="flex">
                  <Input
                    id="comissao"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    className="rounded-r-none disabled:opacity-50 disabled:cursor-not-allowed"
                    value={form.comissao_percent}
                    onChange={e => setForm(p => ({ ...p, comissao_percent: Number(e.target.value || 0) }))}
                    disabled={isConsultor && editando && form.id === user?.id}
                  />
                  <span className="h-8 px-3 inline-flex items-center border border-l-0 rounded-r-lg text-sm bg-slate-50 text-slate-600">%</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status da Conta</Label>
              <select
                id="status"
                className="flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                value={form.ativo ? 'ativo' : 'inativo'}
                onChange={e => setForm(p => ({ ...p, ativo: e.target.value === 'ativo' }))}
                disabled={isConsultor && editando && form.id === user?.id}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo (Bloqueado)</option>
              </select>
            </div>

            <Button 
              type="submit" 
              disabled={saving || (isConsultor && !editando) || (!isAdmin && editando && form.id !== user?.id)}
              className="w-full bg-[#f25c05] hover:bg-[#d84f00] text-white h-10"
            >
              {saving ? 'Salvando...' : 'Salvar Usuário'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={open => !open && setDeleteId(null)}
        title="Excluir usuário"
        description="Esta ação não pode ser desfeita. Deseja realmente remover este usuário?"
        onConfirm={deletarUsuario}
        confirmLabel="Excluir"
        destructive
      />
    </div>
  )
}

function UserGroupCard({
  titulo,
  usuarios,
  userIdLogado,
  onEditar,
  onExcluir,
  loading,
  mostrarSensivel = true,
  perfilUserLogado = 'Admin',
}: {
  titulo: string
  usuarios: UsuarioEquipe[]
  userIdLogado?: string
  onEditar: (usuario: UsuarioEquipe) => void
  onExcluir: (id: string) => void
  loading: boolean
  mostrarSensivel?: boolean
  perfilUserLogado?: string
}) {
  const isConsultor = perfilUserLogado === 'Consultor'

  // Coluna Login: 15% se mostrar, 0 se não
  const loginWidth = mostrarSensivel ? 'w-[15%]' : 'hidden'
  // Coluna Comissão: 14% se mostrar, 0 se não
  const comissaoWidth = mostrarSensivel ? 'w-[14%]' : 'hidden'
  // Coluna Nome: 30% se mostrar Login, 45% se não mostrar
  const nomeWidth = mostrarSensivel ? 'w-[30%]' : 'w-[45%]'
  // Coluna Perfil: 17% se mostrar Login, 22% se não mostrar
  const perfilWidth = mostrarSensivel ? 'w-[17%]' : 'w-[22%]'
  // Coluna Status: 12% se mostrar Login, 17% se não mostrar
  const statusWidth = mostrarSensivel ? 'w-[12%]' : 'w-[17%]'

  return (
    <Card className="gap-0 overflow-visible bg-transparent py-0 ring-0 shadow-none md:gap-4 md:overflow-hidden md:bg-card md:py-4 md:ring-1 md:shadow-sm">
      <CardHeader className="border-b">
        <CardTitle className="text-base text-[#f25c05] uppercase">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <RTable>
          <RTableHeader>
            <RTableRow>
              <RTableHead className={`pl-4 ${nomeWidth}`}>Nome</RTableHead>
              {mostrarSensivel && <RTableHead className={loginWidth}>Login</RTableHead>}
              <RTableHead className={perfilWidth}>Perfil</RTableHead>
              <RTableHead className={statusWidth}>Status</RTableHead>
              {mostrarSensivel && <RTableHead className={comissaoWidth}>Comissão</RTableHead>}
              <RTableHead mobileLabel="" className="text-right pr-4 w-[12%]">Ações</RTableHead>
            </RTableRow>
          </RTableHeader>
          <RTableBody>
            {loading && (
              <RTableRow>
                <RTableCell colSpan={mostrarSensivel ? 6 : 4} className="text-center text-muted-foreground py-8">Carregando usuários...</RTableCell>
              </RTableRow>
            )}

            {!loading && usuarios.length === 0 && (
              <RTableRow>
                <RTableCell colSpan={mostrarSensivel ? 6 : 4} className="text-center text-muted-foreground py-8">Nenhum usuário neste grupo.</RTableCell>
              </RTableRow>
            )}

            {!loading && usuarios.map(usuario => (
              <RTableRow key={usuario.id}>
                <RTableCell className={`pl-4 font-medium truncate ${nomeWidth}`}>
                  {usuario.nome}
                  {usuario.id === userIdLogado && <Badge className="ml-2 bg-[#f25c05] text-white">você</Badge>}
                </RTableCell>
                {mostrarSensivel && (
                  <RTableCell className={`font-mono truncate ${loginWidth}`}>
                    {isConsultor && usuario.id !== userIdLogado ? '●●●●●' : usuario.login}
                  </RTableCell>
                )}
                <RTableCell className={perfilWidth}>
                  <Badge className={usuario.perfil === 'Admin' ? 'bg-slate-900 text-white' : 'bg-[#f25c05] text-white'}>
                    {usuario.perfil === 'Admin' ? 'Administrador' : usuario.perfil}
                  </Badge>
                </RTableCell>
                <RTableCell className={statusWidth}>
                  <Badge className={usuario.ativo ? 'bg-emerald-600 text-white' : 'bg-slate-500 text-white'}>
                    {usuario.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </RTableCell>
                {mostrarSensivel && (
                  <RTableCell className={`tabular-nums ${comissaoWidth}`}>
                    {isConsultor && usuario.id !== userIdLogado ? '●●●●●' : `${Number(usuario.comissao_percent || 0).toFixed(2)}%`}
                  </RTableCell>
                )}
                <RTableCell className="text-right pr-4">
                  <div className="inline-flex gap-2">
                    {isConsultor && usuario.id !== userIdLogado ? (
                      <Button
                        variant="outline"
                        size="icon-sm"
                        disabled
                        title="Você só pode editar sua própria conta"
                      >
                        <Lock className="h-4 w-4 text-slate-400" />
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => onEditar(usuario)}
                          disabled={isConsultor && usuario.id !== userIdLogado}
                          title="Editar usuário"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => onExcluir(usuario.id)}
                          disabled={usuario.id === userIdLogado || isConsultor}
                          title={usuario.id === userIdLogado ? 'Você não pode deletar sua própria conta' : isConsultor ? 'Apenas administradores podem deletar usuários' : 'Deletar usuário'}
                        >
                          {isConsultor || usuario.id === userIdLogado ? <Lock className="h-4 w-4 text-slate-400" /> : <Trash2 className="h-4 w-4 text-red-500" />}
                        </Button>
                      </>
                    )}
                  </div>
                </RTableCell>
              </RTableRow>
            ))}
          </RTableBody>
        </RTable>
      </CardContent>
    </Card>
  )
}
