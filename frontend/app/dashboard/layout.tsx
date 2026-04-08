'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/dashboard/Sidebar'
import Topbar from '@/components/dashboard/Topbar'
import { formatSystemTitle } from '@/lib/page-titles'

function getDashboardTitle(pathname: string) {
  const titleMap: Array<[string, string]> = [
    ['/dashboard/agenda', 'Agenda'],
    ['/dashboard/ajuda', 'Central de Ajuda'],
    ['/dashboard/comissoes', 'Comissões'],
    ['/dashboard/configuracoes', 'Configurações'],
    ['/dashboard/contratos', 'Contratos'],
    ['/dashboard/empresas', 'Empresas'],
    ['/dashboard/fornecedores', 'Fornecedores'],
    ['/dashboard/gestao-evento', 'Gestão do Evento'],
    ['/dashboard/historico-propostas', 'Histórico de Propostas'],
    ['/dashboard/historico', 'Histórico'],
    ['/dashboard/insumos', 'Insumos e Serviços'],
    ['/dashboard/locais', 'Locais e Parques'],
    ['/dashboard/orcamentos', 'Orçamentos'],
    ['/dashboard/parceiros', 'Parceiros e Staff'],
    ['/dashboard/participantes', 'Participantes'],
    ['/dashboard/usuarios-equipe', 'Usuários e Equipe'],
  ]

  if (pathname === '/dashboard') return formatSystemTitle('Dashboard')

  const match = titleMap.find(([prefix]) => pathname.startsWith(prefix))
  return formatSystemTitle(match ? match[1] : 'Dashboard')
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    document.title = getDashboardTitle(pathname)
  }, [pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
