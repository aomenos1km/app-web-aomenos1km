'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { contratos, locais, Local } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

type FormState = {
  empresa_nome: string
  nome_evento: string
  data_evento: string
  local_id: string
  local_nome: string
  local_nao_cadastrado: boolean
  modalidade: string
  qtd_contratada: string
  valor_total: string
  valor_pago: string
  km: string
  consultor: string
  observacoes: string
}

export default function ContratoRetroativoPage() {
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'

  const [loadingLocais, setLoadingLocais] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [listaLocais, setListaLocais] = useState<Local[]>([])
  const [buscaLocal, setBuscaLocal] = useState('')

  const [form, setForm] = useState<FormState>({
    empresa_nome: '',
    nome_evento: '',
    data_evento: '',
    local_id: '',
    local_nome: '',
    local_nao_cadastrado: false,
    modalidade: 'Corrida',
    qtd_contratada: '0',
    valor_total: '0',
    valor_pago: '0',
    km: '0',
    consultor: user?.nome || '',
    observacoes: '',
  })

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

  const locaisFiltrados = useMemo(() => {
    const term = buscaLocal.trim().toLowerCase()
    if (!term) return listaLocais
    return listaLocais.filter(l => `${l.nome} ${l.cidade} ${l.uf}`.toLowerCase().includes(term))
  }, [listaLocais, buscaLocal])

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
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
        nome_evento: form.nome_evento.trim(),
        data_evento: form.data_evento,
        local_id: form.local_nao_cadastrado ? undefined : form.local_id,
        local_nome: form.local_nao_cadastrado ? form.local_nome.trim() : undefined,
        local_nao_cadastrado: form.local_nao_cadastrado,
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
          <p className="text-sm text-muted-foreground">Use para registrar eventos que ja aconteceram fora do sistema.</p>
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
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input value={form.empresa_nome} onChange={e => setField('empresa_nome', e.target.value)} placeholder="Nome da empresa/cliente" required />
            </div>

            <div className="space-y-2">
              <Label>Nome do Evento</Label>
              <Input value={form.nome_evento} onChange={e => setField('nome_evento', e.target.value)} placeholder="Ex.: Corrida de Inverno 2025" required />
            </div>

            <div className="space-y-2">
              <Label>Data do Evento (passada)</Label>
              <Input type="date" value={form.data_evento} onChange={e => setField('data_evento', e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>Consultor Responsavel</Label>
              <Input value={form.consultor} onChange={e => setField('consultor', e.target.value)} placeholder="Nome do consultor" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center gap-2">
                <input
                  id="local-manual"
                  type="checkbox"
                  checked={form.local_nao_cadastrado}
                  onChange={e => setField('local_nao_cadastrado', e.target.checked)}
                />
                <Label htmlFor="local-manual">Local nao cadastrado</Label>
              </div>
            </div>

            {form.local_nao_cadastrado ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Local (texto livre)</Label>
                <Input value={form.local_nome} onChange={e => setField('local_nome', e.target.value)} placeholder="Ex.: Parque Linear, Sao Paulo/SP" required />
              </div>
            ) : (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label>Buscar local cadastrado</Label>
                  <Input
                    value={buscaLocal}
                    onChange={e => setBuscaLocal(e.target.value)}
                    placeholder="Digite nome, cidade ou UF"
                    disabled={loadingLocais}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Local cadastrado</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.local_id}
                    onChange={e => setField('local_id', e.target.value)}
                    disabled={loadingLocais}
                  >
                    <option value="">Selecione um local</option>
                    {locaisFiltrados.map(local => (
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
              <Input value={form.modalidade} onChange={e => setField('modalidade', e.target.value)} placeholder="Corrida" />
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
              <Label>Observacoes</Label>
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
    </div>
  )
}
