'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import BrandLogo from '@/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Sun, Moon } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  const [loginVal, setLoginVal] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erroLogin, setErroLogin] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErroLogin('')
    if (!loginVal || !senha) {
      const msg = 'Preencha login e senha'
      setErroLogin(msg)
      toast.error(msg)
      return
    }

    setLoading(true)
    try {
      await login(loginVal, senha)
      document.cookie = `auth_token=1; path=/; SameSite=Lax`
      const next = searchParams.get('next') || '/dashboard'
      router.push(next)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer login'
      const erro = msg || 'Falha no login. Verifique suas credenciais.'
      setErroLogin(erro)
      toast.error(erro)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="login">Usuário</Label>
        <Input
          id="login"
          autoFocus
          autoComplete="username"
          placeholder="Seu usuário"
          value={loginVal}
          onChange={e => setLoginVal(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          disabled={loading}
        />
      </div>

      <Button type="submit" className="h-11 w-full text-sm font-bold uppercase tracking-[0.18em]" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </Button>

      {erroLogin && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {erroLogin}
        </p>
      )}
    </form>
  )
}

export default function LoginPage() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const isDark = theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark')

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="overflow-hidden border-border/80 bg-card/92 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur">
          <CardHeader className="relative space-y-5 border-b border-border px-6 py-8">
            <div className="absolute right-6 top-8 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                aria-label="Alternar modo escuro"
                aria-pressed={isDark}
                className={`inline-flex h-8 w-14 items-center rounded-full border transition-colors p-0.5 ${
                  isDark ? 'border-orange-500/60 bg-orange-500/20' : 'border-amber-300/60 bg-amber-100/40'
                }`}
              >
                <span
                  className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform flex items-center justify-center ${
                    isDark ? 'translate-x-6' : 'translate-x-0'
                  }`}
                >
                  {isDark ? <Moon className="h-3 w-3 text-orange-500" /> : <Sun className="h-3 w-3 text-amber-600" />}
                </span>
              </button>
            </div>
            <div className="flex justify-center">
              <BrandLogo className="mx-auto" />
            </div>
            <div className="space-y-1 text-center">
              <h1 className="font-heading text-2xl font-extrabold tracking-[-0.04em] text-foreground">
                Acesso Administrativo
              </h1>
              <p className="text-sm text-muted-foreground">
                Plataforma de gestão esportiva da Aomenos1km
              </p>
            </div>
          </CardHeader>

          <CardContent className="px-6 py-6">
            <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-muted" />}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-xs font-medium text-muted-foreground">
          © {new Date().getFullYear()} Aomenos1km • Orumis
        </p>
        </div>
    </main>
  )
}
