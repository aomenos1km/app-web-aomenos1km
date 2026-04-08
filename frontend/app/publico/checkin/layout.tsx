import type { Metadata } from 'next'
import { formatPublicTitle } from '@/lib/page-titles'

export const metadata: Metadata = {
  title: formatPublicTitle('Check-in do Evento'),
}

export default function CheckinPublicoLayout({ children }: { children: React.ReactNode }) {
  return children
}
