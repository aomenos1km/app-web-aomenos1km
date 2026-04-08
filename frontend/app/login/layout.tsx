import type { Metadata } from 'next'
import { formatSystemTitle } from '@/lib/page-titles'

export const metadata: Metadata = {
  title: formatSystemTitle('Entrar'),
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
