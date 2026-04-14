'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import BrandLogo from '@/components/BrandLogo'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { HELP_CATEGORY_ORDER, groupSectionsByCategory } from '@/lib/help-center'
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  UserCircle2,
  LogOut,
} from 'lucide-react'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar-collapsed') === '1'
  })
  const grouped = useMemo(() => groupSectionsByCategory(), [])

  const isDark = theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark')

  function toggleTheme() {
    setTheme(isDark ? 'light' : 'dark')
  }

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', next ? '1' : '0')
  }

  function isRouteActive(route: string) {
    if (route === '/dashboard') return pathname === route
    return pathname === route || pathname.startsWith(route + '/')
  }

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-card border-r transition-[transform,width] duration-200',
          collapsed ? 'w-20' : 'w-72',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:z-auto',
        )}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          className="absolute -right-3 top-1/2 z-40 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-md transition-colors hover:text-foreground lg:inline-flex"
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* Logo */}
        <div className={cn('border-b', collapsed ? 'px-2 py-4' : 'px-5 py-5')}>
          <div className={cn('flex justify-center', collapsed && 'scale-75')}>
            <BrandLogo compact imageClassName="w-[132px]" />
          </div>
          {!collapsed && (
            <p className="mt-3 text-center text-xs font-semibold tracking-[0.16em] text-muted-foreground">
              GESTÃO ESPORTIVA
            </p>
          )}
        </div>

        {/* Nav */}
        <nav className={cn('flex-1 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-3')}>
          {HELP_CATEGORY_ORDER.map(category => {
            const sections = grouped[category].filter(section => section.id !== 'participantes')
            if (sections.length === 0) return null

            return (
              <div key={category} className="mb-4">
                {!collapsed && (
                  <p className="px-2 pb-1 text-xs font-black tracking-wide text-foreground/80">{category}</p>
                )}

                <div className="space-y-0.5">
                  {sections.map(({ id, route, label, icon: Icon }) => {
                    const active = isRouteActive(route)

                    return (
                      <Link
                        key={id}
                        href={route}
                        onClick={onClose}
                        title={collapsed ? label : undefined}
                        className={cn(
                          'group flex items-center rounded-lg py-2 text-sm font-medium transition-colors',
                          collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="flex-1">{label}</span>}
                        {!collapsed && active && <ChevronRight className="h-3 w-3 opacity-60" />}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className={cn('border-t space-y-2', collapsed ? 'p-2' : 'p-3')}>
          {!collapsed && (
            <div className="flex items-center justify-between rounded-lg px-2 py-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Moon className="h-4 w-4" /> Modo Escuro
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Alternar modo escuro"
                aria-pressed={isDark}
                className={cn(
                  'inline-flex h-5 w-9 items-center rounded-full border transition-colors p-0.5',
                  isDark ? 'border-orange-500/60 bg-orange-500/20' : 'border-amber-300/60 bg-amber-100/40',
                )}
              >
                <span
                  className={cn(
                    'h-4 w-4 rounded-full bg-white shadow-sm transition-transform flex items-center justify-center',
                    isDark ? 'translate-x-4' : 'translate-x-0',
                  )}
                >
                  {isDark ? <Moon className="h-2.5 w-2.5 text-orange-500" /> : <Sun className="h-2.5 w-2.5 text-amber-600" />}
                </span>
              </button>
            </div>
          )}

          {!collapsed && (
            <div className="flex items-center gap-2 rounded-lg px-2 py-1">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <UserCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{user?.nome || 'Usuário'}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.perfil || 'Perfil'}</p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={logout}
            className={cn(
              'flex w-full items-center justify-center rounded-lg border border-destructive/40 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 active:bg-destructive/15',
              collapsed ? 'px-1' : 'gap-2 px-3',
            )}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && 'Sair'}
          </button>
          {!collapsed && <p className="px-1 text-xs text-muted-foreground">v1.0.0 · Orumis</p>}
        </div>
      </aside>
    </>
  )
}
