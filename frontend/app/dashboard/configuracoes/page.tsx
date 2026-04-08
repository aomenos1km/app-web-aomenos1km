'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Settings } from 'lucide-react'
import { configuracoes, type ConfiguracaoSistema } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
}

export default function ConfiguracoesPage() {
  const { user } = useAuth()
  const isAdmin = user?.perfil === 'Admin'

  const [loadingCfg, setLoadingCfg] = useState(true)
  const [savingCfg, setSavingCfg] = useState(false)
  const [cfg, setCfg] = useState<ConfiguracaoSistema>(defaults)

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
            <p className="text-xs text-muted-foreground">Se o grupo for menor que o limite, cobra o Setup Mínimo.</p>
          </div>
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
