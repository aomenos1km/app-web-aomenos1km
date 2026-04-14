'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Settings } from 'lucide-react'
import { configuracoes, dashboard, type ConfiguracaoSistema, type MetaMensalDetalhada } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const MESES = [
  { mes: 1, label: 'Janeiro' },
  { mes: 2, label: 'Fevereiro' },
  { mes: 3, label: 'Março' },
  { mes: 4, label: 'Abril' },
  { mes: 5, label: 'Maio' },
  { mes: 6, label: 'Junho' },
  { mes: 7, label: 'Julho' },
  { mes: 8, label: 'Agosto' },
  { mes: 9, label: 'Setembro' },
  { mes: 10, label: 'Outubro' },
  { mes: 11, label: 'Novembro' },
  { mes: 12, label: 'Dezembro' },
]

const defaults: ConfiguracaoSistema = {
  margem_lucro: 75,
  custo_operacional_fixo: 5,
  adicional_kit_premium: 40,
  preco_backup_camiseta: 25,
  preco_backup_medalha: 15,
  preco_backup_squeeze: 10,
  preco_backup_bag: 12,
  preco_backup_lanche: 15,
  preco_backup_trofeu: 45,
  setup_minimo: 1200,
  limite_setup_pessoas: 150,
  formas_pagamento_disponiveis: ['PIX', 'Transferência', 'Boleto', 'Cartão'],
  max_parcelas_sem_juros: 3,
  permite_parcelamento_pix_transferencia_boleto: false,
  entrada_min_percent: 30,
  multa_atraso_percent: 2,
  juros_mes_percent: 1,
  texto_condicoes_pagamento: 'Entrada mínima de 30% na assinatura e saldo até a data do evento.',
}

function moedaMaskInput(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))
}

function parseMoedaInput(value: string) {
  const digits = String(value || '').replace(/\D/g, '')
  return Number(digits || 0) / 100
}

export default function ConfiguracoesPage() {
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'

  const [loadingCfg, setLoadingCfg] = useState(true)
  const [savingCfg, setSavingCfg] = useState(false)
  const [cfg, setCfg] = useState<ConfiguracaoSistema>(defaults)
  const [anoMetas, setAnoMetas] = useState(String(new Date().getFullYear()))
  const [loadingMetas, setLoadingMetas] = useState(false)
  const [savingMetaMes, setSavingMetaMes] = useState<number | null>(null)
  const [metas, setMetas] = useState<MetaMensalDetalhada[]>([])

  const metasCompletas = useMemo(() => {
    return MESES.map(item => {
      const atual = metas.find(m => m.mes === item.mes)
      return {
        mes: item.mes,
        label: item.label,
        meta_vendas: Number(atual?.meta_vendas || 0),
        meta_contratos: Number(atual?.meta_contratos || 0),
        descricao: atual?.descricao || '',
      }
    })
  }, [metas])

  useEffect(() => {
    async function carregar() {
      setLoadingCfg(true)
      try {
        const res = await configuracoes.buscar()
        if (res?.success && res.data) {
          setCfg(res.data)
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar configurações')
      } finally {
        setLoadingCfg(false)
      }
    }
    void carregar()
  }, [])

  useEffect(() => {
    async function carregarMetas() {
      setLoadingMetas(true)
      try {
        const res = await dashboard.listarMetas(anoMetas)
        setMetas((res.data || []) as MetaMensalDetalhada[])
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar metas mensais')
      } finally {
        setLoadingMetas(false)
      }
    }
    void carregarMetas()
  }, [anoMetas])

  async function onSaveConfig() {
    if (!isAdmin) {
      toast.error('Somente administradores podem alterar configurações globais')
      return
    }

    setSavingCfg(true)
    try {
      await configuracoes.salvar(cfg)
      toast.success('Configurações do sistema salvas com sucesso')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar configurações')
    } finally {
      setSavingCfg(false)
    }
  }

  async function onSaveMeta(meta: { mes: number; meta_vendas: number; meta_contratos: number; descricao: string }) {
    if (!isAdmin) {
      toast.error('Somente administradores podem alterar metas mensais')
      return
    }

    setSavingMetaMes(meta.mes)
    try {
      await dashboard.salvarMeta(meta.mes, Number(anoMetas), {
        meta_vendas: Number(meta.meta_vendas || 0),
        meta_contratos: Number(meta.meta_contratos || 0),
        descricao: meta.descricao || '',
      })
      const res = await dashboard.listarMetas(anoMetas)
      setMetas((res.data || []) as MetaMensalDetalhada[])
      toast.success(`Meta de ${MESES[meta.mes - 1]?.label || `Mês ${meta.mes}`} salva com sucesso`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar meta mensal')
    } finally {
      setSavingMetaMes(null)
    }
  }

  function onChangeMeta(mes: number, field: 'meta_vendas' | 'meta_contratos' | 'descricao', value: number | string) {
    setMetas(prev => {
      const idx = prev.findIndex(m => m.mes === mes)
      if (idx === -1) {
        return [
          ...prev,
          {
            mes,
            ano: Number(anoMetas),
            meta_vendas: field === 'meta_vendas' ? Number(value || 0) : 0,
            meta_contratos: field === 'meta_contratos' ? Number(value || 0) : 0,
            descricao: field === 'descricao' ? String(value || '') : '',
          },
        ]
      }
      const clone = [...prev]
      clone[idx] = {
        ...clone[idx],
        [field]: field === 'descricao' ? String(value || '') : Number(value || 0),
      }
      return clone
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-5 w-5 text-[#f25c05]" /> Configurações do Sistema</h1>
          <p className="text-sm text-muted-foreground">Defina as regras globais de precificação e custos de segurança.</p>
        </div>
        <Button onClick={onSaveConfig} disabled={loadingCfg || savingCfg || !isAdmin} className="bg-[#f25c05] hover:bg-[#d84f00] text-white">
          {savingCfg ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#f25c05]">Regras: Formulário Público (Site)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldCurrency label="Margem de Lucro (%)" value={cfg.margem_lucro} onChange={v => setCfg(p => ({ ...p, margem_lucro: v }))} prefix="%" disabled={!isAdmin} />
            <FieldCurrency label="Custo Operacional Fixo (por pessoa)" value={cfg.custo_operacional_fixo} onChange={v => setCfg(p => ({ ...p, custo_operacional_fixo: v }))} disabled={!isAdmin} />
            <FieldCurrency label="Adicional Kit Premium (White Label)" value={cfg.adicional_kit_premium} onChange={v => setCfg(p => ({ ...p, adicional_kit_premium: v }))} disabled={!isAdmin} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-red-500">Preços de Segurança (Backup)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <p>Estes valores só são usados se o item não for encontrado em Insumos & Serviços.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldCurrency label="Camiseta Tech" value={cfg.preco_backup_camiseta} onChange={v => setCfg(p => ({ ...p, preco_backup_camiseta: v }))} disabled={!isAdmin} />
              <FieldCurrency label="Medalha" value={cfg.preco_backup_medalha} onChange={v => setCfg(p => ({ ...p, preco_backup_medalha: v }))} disabled={!isAdmin} />
              <FieldCurrency label="Squeeze" value={cfg.preco_backup_squeeze} onChange={v => setCfg(p => ({ ...p, preco_backup_squeeze: v }))} disabled={!isAdmin} />
              <FieldCurrency label="Bag Esportiva" value={cfg.preco_backup_bag} onChange={v => setCfg(p => ({ ...p, preco_backup_bag: v }))} disabled={!isAdmin} />
              <FieldCurrency label="Kit Lanche" value={cfg.preco_backup_lanche} onChange={v => setCfg(p => ({ ...p, preco_backup_lanche: v }))} disabled={!isAdmin} />
              <FieldCurrency label="Troféu" value={cfg.preco_backup_trofeu} onChange={v => setCfg(p => ({ ...p, preco_backup_trofeu: v }))} disabled={!isAdmin} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[#f25c05]">Regras: Orçamento Interno</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FieldCurrency label="Taxa Setup Mínimo" value={cfg.setup_minimo} onChange={v => setCfg(p => ({ ...p, setup_minimo: v }))} disabled={!isAdmin} />
          <div className="space-y-1.5">
            <Label>Limite (Pessoas)</Label>
            <Input
              type="number"
              min={1}
              value={cfg.limite_setup_pessoas}
              disabled={!isAdmin}
              onChange={e => setCfg(p => ({ ...p, limite_setup_pessoas: Math.max(1, Number(e.target.value || 1)) }))}
            />
            <p className="text-xs text-muted-foreground">Se o grupo for menor ou igual ao limite, cobra o Setup Mínimo.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[#f25c05]">Política de Pagamento (Proposta e Contrato)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FieldCurrency label="Entrada mínima (%)" value={cfg.entrada_min_percent} onChange={v => setCfg(p => ({ ...p, entrada_min_percent: v }))} prefix="%" disabled={!isAdmin} />
            <div className="space-y-1.5">
              <Label>Máx. parcelas sem juros</Label>
              <Input
                type="number"
                min={1}
                value={cfg.max_parcelas_sem_juros}
                disabled={!isAdmin}
                onChange={e => setCfg(p => ({ ...p, max_parcelas_sem_juros: Math.max(1, Number(e.target.value || 1)) }))}
              />
            </div>
            <FieldCurrency label="Multa por atraso (%)" value={cfg.multa_atraso_percent} onChange={v => setCfg(p => ({ ...p, multa_atraso_percent: v }))} prefix="%" disabled={!isAdmin} />
            <FieldCurrency label="Juros ao mês (%)" value={cfg.juros_mes_percent} onChange={v => setCfg(p => ({ ...p, juros_mes_percent: v }))} prefix="%" disabled={!isAdmin} />
          </div>

          <div className="space-y-1.5">
            <Label>Formas de pagamento disponíveis (separadas por vírgula)</Label>
            <Input
              value={(cfg.formas_pagamento_disponiveis || []).join(', ')}
              disabled={!isAdmin}
              onChange={e => {
                const formas = e.target.value
                  .split(',')
                  .map(v => v.trim())
                  .filter(Boolean)
                setCfg(p => ({ ...p, formas_pagamento_disponiveis: formas }))
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Permitir parcelamento para PIX/Transferência/Boleto</Label>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              disabled={!isAdmin}
              value={cfg.permite_parcelamento_pix_transferencia_boleto ? 'sim' : 'nao'}
              onChange={e => setCfg(p => ({ ...p, permite_parcelamento_pix_transferencia_boleto: e.target.value === 'sim' }))}
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Texto padrão das condições de pagamento</Label>
            <textarea
              className="min-h-[110px] w-full rounded-md border bg-background p-3 text-sm"
              disabled={!isAdmin}
              value={cfg.texto_condicoes_pagamento || ''}
              onChange={e => setCfg(p => ({ ...p, texto_condicoes_pagamento: e.target.value }))}
              placeholder="Ex.: Entrada de 30% na assinatura, saldo em até 3 parcelas sem juros até a data do evento."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base text-[#f25c05]">Metas Mensais</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="ano-metas" className="text-sm text-muted-foreground">Ano</Label>
              <Input
                id="ano-metas"
                type="number"
                min={2000}
                max={2100}
                className="w-[110px]"
                value={anoMetas}
                onChange={e => setAnoMetas(String(e.target.value || new Date().getFullYear()))}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMetas ? (
            <p className="text-sm text-muted-foreground">Carregando metas...</p>
          ) : (
            <div className="space-y-3">
              {metasCompletas.map(meta => (
                <div key={meta.mes} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{meta.label}</p>
                    <Button
                      size="sm"
                      onClick={() => void onSaveMeta(meta)}
                      disabled={!isAdmin || savingMetaMes === meta.mes}
                      className="bg-[#f25c05] hover:bg-[#d84f00] text-white"
                    >
                      {savingMetaMes === meta.mes ? 'Salvando...' : 'Salvar mês'}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Meta de Vendas (R$)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={moedaMaskInput(meta.meta_vendas)}
                        disabled={!isAdmin}
                        onChange={e => onChangeMeta(meta.mes, 'meta_vendas', parseMoedaInput(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Meta Contratos</Label>
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={meta.meta_contratos}
                        disabled={!isAdmin}
                        onChange={e => onChangeMeta(meta.mes, 'meta_contratos', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Descrição</Label>
                    <Input
                      value={meta.descricao}
                      disabled={!isAdmin}
                      onChange={e => onChangeMeta(meta.mes, 'descricao', e.target.value)}
                      placeholder="Ex.: Foco em eventos corporativos no trimestre"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FieldCurrency({
  label,
  value,
  onChange,
  prefix = 'R$',
  disabled = false,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  prefix?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex">
        <span className="h-8 px-3 inline-flex items-center border border-r-0 rounded-l-lg text-sm bg-slate-50 text-slate-600">{prefix}</span>
        <Input
          type="number"
          step="0.01"
          min={0}
          value={Number.isFinite(value) ? value : 0}
          disabled={disabled}
          className="rounded-l-none"
          onChange={e => onChange(Number(e.target.value || 0))}
        />
      </div>
    </div>
  )
}
