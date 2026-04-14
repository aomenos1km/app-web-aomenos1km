import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { buildEventoMetadata, fetchEventoPublicoMetadata } from '@/lib/publico-metadata'

type SlugParams = { slug: string }

export async function generateMetadata({ params }: { params: SlugParams | Promise<SlugParams> }): Promise<Metadata> {
  const resolved = await params
  const slugRaw = String(resolved?.slug || '').trim()
  const evento = await fetchEventoPublicoMetadata({ slug: slugRaw })
  return buildEventoMetadata(evento, `/${encodeURIComponent(slugRaw)}`)
}

export default async function EventoSlugPage({ params }: { params: SlugParams | Promise<SlugParams> }) {
  const resolved = await params
  const slugRaw = String(resolved?.slug || '').trim()
  const slug = encodeURIComponent(slugRaw)

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

  try {
    const res = await fetch(`${apiBase}/api/eventos/publico/slug/${slug}`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const body = (await res.json()) as { data?: { id?: string } }
      const id = encodeURIComponent(body?.data?.id || '')
      if (id) {
        redirect(`/publico/checkin?slug=${slug}&id=${id}`)
      }
    }
  } catch {
    // fallback abaixo
  }

  redirect(`/publico/checkin?slug=${slug}`)
}
