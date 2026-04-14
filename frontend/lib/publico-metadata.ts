import type { Metadata } from 'next'
import { TITLE_SITE_DEFAULT } from '@/lib/page-titles'

type EventoPublicoShare = {
  id: string
  nome_evento?: string
  empresa_nome?: string
  data_evento?: string
  local_nome?: string
  capa_url?: string
}

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aomenos1km.com.br'
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const EVENTO_SHARE_FALLBACK = '/arte-aomenos1km-corridas-padrao.jpeg'

function toAbsoluteUrl(url: string) {
  if (!url) return `${SITE_BASE}${EVENTO_SHARE_FALLBACK}`
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${SITE_BASE}${url}`
  return `${SITE_BASE}/${url}`
}

function formatarDataBr(data?: string) {
  if (!data) return ''
  const raw = String(data).trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR')
}

function descricaoEvento(evento: EventoPublicoShare) {
  const partes = [
    evento.empresa_nome ? `Evento ${evento.empresa_nome}` : '',
    formatarDataBr(evento.data_evento),
    evento.local_nome || '',
  ].filter(Boolean)

  if (partes.length === 0) {
    return 'Faça seu check-in no evento da Aomenos1km.'
  }

  return `${partes.join(' · ')}. Garanta sua inscrição no check-in da Aomenos1km.`
}

export async function fetchEventoPublicoMetadata({ id, slug }: { id?: string; slug?: string }) {
  const idClean = String(id || '').trim()
  const slugClean = String(slug || '').trim()

  let endpoint = ''
  if (idClean) {
    endpoint = `/api/eventos/${encodeURIComponent(idClean)}/publico`
  } else if (slugClean) {
    endpoint = `/api/eventos/publico/slug/${encodeURIComponent(slugClean)}`
  } else {
    return null
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const body = (await res.json()) as { data?: EventoPublicoShare }
    return body?.data || null
  } catch {
    return null
  }
}

export function buildEventoMetadata(evento: EventoPublicoShare | null, path: string): Metadata {
  const url = toAbsoluteUrl(path)

  if (!evento) {
    return {
      title: `Check-in do Evento | ${TITLE_SITE_DEFAULT}`,
      description: 'Faça seu check-in no evento da Aomenos1km.',
      alternates: { canonical: url },
      openGraph: {
        type: 'website',
        title: `Check-in do Evento | ${TITLE_SITE_DEFAULT}`,
        description: 'Faça seu check-in no evento da Aomenos1km.',
        url,
        images: [
          {
            url: toAbsoluteUrl(EVENTO_SHARE_FALLBACK),
            width: 1200,
            height: 630,
            alt: 'Aomenos1km',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `Check-in do Evento | ${TITLE_SITE_DEFAULT}`,
        description: 'Faça seu check-in no evento da Aomenos1km.',
        images: [toAbsoluteUrl(EVENTO_SHARE_FALLBACK)],
      },
    }
  }

  const titulo = `${evento.nome_evento || 'Evento'} | Check-in Aomenos1km`
  const descricao = descricaoEvento(evento)
  const imagem = toAbsoluteUrl(evento.capa_url || EVENTO_SHARE_FALLBACK)

  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: titulo,
      description: descricao,
      url,
      images: [
        {
          url: imagem,
          width: 1200,
          height: 630,
          alt: evento.nome_evento || 'Evento Aomenos1km',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descricao,
      images: [imagem],
    },
  }
}
