'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Download, Mail, ShieldAlert } from 'lucide-react'
import { transmissao, type InscricaoTransmissao } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  RTable,
  RTableBody,
  RTableCell,
  RTableHead,
  RTableHeader,
  RTableRow,
} from '@/components/ui/responsive-table'

function formatarData(dataIso: string) {
  const data = new Date(dataIso)
  if (Number.isNaN(data.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  const dia = pad(data.getDate())
  const mes = pad(data.getMonth() + 1)
  const ano = data.getFullYear()
  const hora = pad(data.getHours())
  const minuto = pad(data.getMinutes())
  const segundo = pad(data.getSeconds())
  return `${dia}/${mes}/${ano} às ${hora}:${minuto}:${segundo}`
}

function formatarDataCsv(dataIso: string) {
  const data = new Date(dataIso)
  if (Number.isNaN(data.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const ano = data.getFullYear()
  const mes = pad(data.getMonth() + 1)
  const dia = pad(data.getDate())
  const hora = pad(data.getHours())
  const minuto = pad(data.getMinutes())
  const segundo = pad(data.getSeconds())
  return `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`
}

function csvEscape(value: string) {
  const normalized = String(value ?? '')
  return `"${normalized.replace(/"/g, '""')}"`
}

export default function TransmissaoPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [lista, setLista] = useState<InscricaoTransmissao[]>([])
  const [busca, setBusca] = useState('')

  const isAdmin = user?.perfil === 'Admin'

  async function carregar() {
    if (!isAdmin) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await transmissao.listarInscricoes()
      setLista(res.data || [])
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Sessão expirada') {
        toast.warning('Sua sessão expirou. Redirecionando para o login...')
      } else {
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar inscrições')
      }
      setLista([])
    } finally {
      setLoading(false)
    }
  }

  async function carregarSilencioso() {
    if (!isAdmin || document.visibilityState !== 'visible') return

    try {
      const res = await transmissao.listarInscricoes()
      setLista(res.data || [])
    } catch {
      // Falha silenciosa para não gerar ruído no dashboard.
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return

    const interval = setInterval(() => {
      void carregarSilencioso()
    }, 15000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return lista
    return lista.filter(item =>
      item.email.toLowerCase().includes(termo) ||
      item.origem.toLowerCase().includes(termo),
    )
  }, [lista, busca])

  function exportarCsv() {
    if (filtrados.length === 0) {
      toast.info('Não há inscrições para exportar')
      return
    }

    const linhas = [
      ['email', 'origem', 'status', 'inscrito_em'],
      ...filtrados.map(item => [
        item.email,
        item.origem,
        item.ativo ? 'ativo' : 'inativo',
        formatarDataCsv(item.inscrito_em),
      ]),
    ]

    const csv = linhas
      .map(cols => cols.map(col => csvEscape(col)).join(';'))
      .join('\n')

    const csvComBom = '\uFEFF' + csv
    const blob = new Blob([csvComBom], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lista-transmissao-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success('Exportação concluída')
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Acesso restrito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Apenas administradores podem visualizar a lista de transmissão.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#f25c05]" /> Lista de Transmissão
          </h1>
          <p className="text-sm text-muted-foreground">
            Emails captados pela landing page para avisos de lançamento.
          </p>
          <p className="text-xs text-muted-foreground/80 mt-1">
            Atualização automática a cada 15s.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">{filtrados.length} inscritos</Badge>
          <Button onClick={exportarCsv} className="bg-[#f25c05] hover:bg-[#d84f00] text-white">
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Input
            placeholder="Buscar por e-mail ou origem..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />

          <RTable>
            <RTableHeader>
              <RTableRow>
                <RTableHead>E-mail</RTableHead>
                <RTableHead>Origem</RTableHead>
                <RTableHead>Status</RTableHead>
                <RTableHead>Inscrito em</RTableHead>
              </RTableRow>
            </RTableHeader>
            <RTableBody>
              {loading ? (
                <RTableRow>
                  <RTableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Carregando inscrições...
                  </RTableCell>
                </RTableRow>
              ) : filtrados.length === 0 ? (
                <RTableRow>
                  <RTableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nenhuma inscrição encontrada.
                  </RTableCell>
                </RTableRow>
              ) : (
                filtrados.map(item => (
                  <RTableRow key={item.id}>
                    <RTableCell className="font-medium">{item.email}</RTableCell>
                    <RTableCell className="uppercase text-xs tracking-wide">{item.origem}</RTableCell>
                    <RTableCell>
                      <Badge variant={item.ativo ? 'default' : 'secondary'}>
                        {item.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </RTableCell>
                    <RTableCell>{formatarData(item.inscrito_em)}</RTableCell>
                  </RTableRow>
                ))
              )}
            </RTableBody>
          </RTable>
        </CardContent>
      </Card>
    </div>
  )
}
