export type ComercialEstruturado = {
  entradaPercent: number
  qtdParcelas: number
  intervaloDias: number
  primeiroVencimentoDias: number
  validadeDias: number
  entregaDiasAntes: number
}

export const COMERCIAL_DEFAULTS: ComercialEstruturado = {
  entradaPercent: 50,
  qtdParcelas: 2,
  intervaloDias: 30,
  primeiroVencimentoDias: 7,
  validadeDias: 10,
  entregaDiasAntes: 2,
}

const COMERCIAL_TAG_RE = /\[comercial:([^\]]+)\]/i
const CONDICOES_TAG_RE = /\[condicoes:([^\]]+)\]/i

function clampInt(value: number, min: number, max: number) {
  const n = Number.isFinite(value) ? Math.trunc(value) : min
  return Math.min(max, Math.max(min, n))
}

export function normalizeComercialEstruturado(input: Partial<ComercialEstruturado> | undefined): ComercialEstruturado {
  const base = { ...COMERCIAL_DEFAULTS, ...(input || {}) }
  const entradaPercent = clampInt(Number(base.entradaPercent), 0, 100)
  const qtdParcelas = clampInt(Number(base.qtdParcelas), 1, 24)
  const intervaloDias = clampInt(Number(base.intervaloDias), 1, 120)
  const primeiroVencimentoDias = clampInt(Number(base.primeiroVencimentoDias), 0, 120)
  const validadeDias = clampInt(Number(base.validadeDias), 1, 90)
  const entregaDiasAntes = clampInt(Number(base.entregaDiasAntes), 0, 60)

  return {
    entradaPercent,
    qtdParcelas,
    intervaloDias,
    primeiroVencimentoDias,
    validadeDias,
    entregaDiasAntes,
  }
}

export function buildComercialTag(input: Partial<ComercialEstruturado> | undefined) {
  const c = normalizeComercialEstruturado(input)
  return `[comercial:entrada_percent=${c.entradaPercent};qtd_parcelas=${c.qtdParcelas};intervalo_dias=${c.intervaloDias};primeiro_vencimento_dias=${c.primeiroVencimentoDias};validade_dias=${c.validadeDias};entrega_dias_antes=${c.entregaDiasAntes}]`
}

export function parseComercialTag(text?: string): ComercialEstruturado | null {
  const raw = String(text || '')
  const match = raw.match(COMERCIAL_TAG_RE)
  if (!match?.[1]) return null

  const entries = match[1]
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)

  const parsed: Partial<ComercialEstruturado> = {}
  for (const entry of entries) {
    const [key, value] = entry.split('=')
    const v = Number(value)
    if (!Number.isFinite(v)) continue

    if (key === 'entrada_percent') parsed.entradaPercent = v
    if (key === 'qtd_parcelas') parsed.qtdParcelas = v
    if (key === 'intervalo_dias') parsed.intervaloDias = v
    if (key === 'primeiro_vencimento_dias') parsed.primeiroVencimentoDias = v
    if (key === 'validade_dias') parsed.validadeDias = v
    if (key === 'entrega_dias_antes') parsed.entregaDiasAntes = v
  }

  return normalizeComercialEstruturado(parsed)
}

export function stripComercialTag(text?: string) {
  return String(text || '').replace(COMERCIAL_TAG_RE, '').replace(/\s{2,}/g, ' ').trim()
}

export function buildCondicoesTag(input: { condPagto?: string; condValidade?: string; condEntrega?: string }) {
  const pagto = encodeURIComponent(String(input.condPagto || '').trim())
  const validade = encodeURIComponent(String(input.condValidade || '').trim())
  const entrega = encodeURIComponent(String(input.condEntrega || '').trim())
  return `[condicoes:pagto=${pagto};validade=${validade};entrega=${entrega}]`
}

export function parseCondicoesTag(text?: string) {
  const raw = String(text || '')
  const match = raw.match(CONDICOES_TAG_RE)
  if (!match?.[1]) return null

  const out: { condPagto?: string; condValidade?: string; condEntrega?: string } = {}
  const parts = match[1]
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)

  for (const part of parts) {
    const [key, value] = part.split('=')
    const decoded = decodeURIComponent(String(value || ''))
    if (key === 'pagto') out.condPagto = decoded
    if (key === 'validade') out.condValidade = decoded
    if (key === 'entrega') out.condEntrega = decoded
  }

  return out
}

export function stripCondicoesTag(text?: string) {
  return String(text || '').replace(CONDICOES_TAG_RE, '').replace(/\s{2,}/g, ' ').trim()
}

export function buildCondicoesFromComercial(input: Partial<ComercialEstruturado> | undefined) {
  const c = normalizeComercialEstruturado(input)
  const pluralize = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`

  const vencimentoTexto = c.primeiroVencimentoDias === 0
    ? 'no ato da assinatura'
    : `em ${pluralize(c.primeiroVencimentoDias, 'dia', 'dias')} após a assinatura`

  let condPagto = ''
  if (c.entradaPercent >= 100 || (c.entradaPercent === 0 && c.qtdParcelas <= 1)) {
    // Pagamento à vista (sem entrada explícita ou 100% na assinatura)
    condPagto = `Pagamento à vista, com vencimento ${vencimentoTexto}.`
  } else if (c.entradaPercent === 0) {
    // Parcelado sem entrada
    const totalParcelasTexto = pluralize(c.qtdParcelas, 'parcela', 'parcelas')
    const intervaloTexto = pluralize(c.intervaloDias, 'dia', 'dias')
    condPagto = `Pagamento em ${totalParcelasTexto}, com intervalo de ${intervaloTexto} entre parcelas; primeira parcela com vencimento ${vencimentoTexto}.`
  } else if (c.qtdParcelas <= 1) {
    // 100% na assinatura (com entrada de 100%)
    condPagto = `Pagamento à vista, com vencimento ${vencimentoTexto}.`
  } else {
    // Entrada + saldo parcelado
    const saldo = Math.max(0, 100 - c.entradaPercent)
    const saldoParcelas = Math.max(1, c.qtdParcelas - 1)
    const saldoParcelasTexto = pluralize(saldoParcelas, 'parcela', 'parcelas')
    const intervaloTexto = pluralize(c.intervaloDias, 'dia', 'dias')
    condPagto = `${c.entradaPercent}% na assinatura e saldo de ${saldo}% em ${saldoParcelasTexto}, com intervalo de ${intervaloTexto} entre parcelas; primeira parcela com vencimento ${vencimentoTexto}.`
  }

  const condValidade = `${c.validadeDias} dias corridos`
  const condEntrega = c.entregaDiasAntes > 0
    ? `Até ${c.entregaDiasAntes} dias antes do evento`
    : 'Na data do evento'

  return { condPagto, condValidade, condEntrega, comercial: c }
}
