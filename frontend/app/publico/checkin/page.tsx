import { Suspense } from 'react'
import type { Metadata } from 'next'
import CheckinClientPage from './CheckinClient'
import { buildEventoMetadata, fetchEventoPublicoMetadata } from '@/lib/publico-metadata'

type SearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>
}

function getFirstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return String(value[0] || '')
  return String(value || '')
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const resolvedSearchParams = (await searchParams) || {}
  const id = getFirstParam(resolvedSearchParams.id).trim()
  const slug = getFirstParam(resolvedSearchParams.slug).trim()

  const query = new URLSearchParams()
  if (slug) query.set('slug', slug)
  if (id) query.set('id', id)

  const path = `/publico/checkin${query.toString() ? `?${query.toString()}` : ''}`
  const evento = await fetchEventoPublicoMetadata({ id, slug })
  return buildEventoMetadata(evento, path)
}

export default function CheckinPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-4">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </main>
      }
    >
      <CheckinClientPage />
    </Suspense>
  )
}
