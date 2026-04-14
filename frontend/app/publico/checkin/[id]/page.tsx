import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { buildEventoMetadata, fetchEventoPublicoMetadata } from '@/lib/publico-metadata'

type IdParams = { id: string }

export async function generateMetadata({ params }: { params: IdParams | Promise<IdParams> }): Promise<Metadata> {
  const resolved = await params
  const idRaw = String(resolved?.id || '').trim()
  const evento = await fetchEventoPublicoMetadata({ id: idRaw })
  return buildEventoMetadata(evento, `/publico/checkin/${encodeURIComponent(idRaw)}`)
}

export default async function CheckinByIdPage({ params }: { params: IdParams | Promise<IdParams> }) {
  const resolved = await params
  const id = encodeURIComponent(resolved?.id || '')
  redirect(`/publico/checkin?id=${id}`)
}
