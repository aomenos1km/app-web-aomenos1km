import type { Metadata } from 'next'
import { formatPublicTitle } from '@/lib/page-titles'

export const metadata: Metadata = {
  title: formatPublicTitle('Solicitação de Orçamento'),
}

export default function FormularioSolicitacaoEventoLayout({ children }: { children: React.ReactNode }) {
  return children
}
