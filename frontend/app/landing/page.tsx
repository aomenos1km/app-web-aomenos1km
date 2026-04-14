'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Mail, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { transmissao } from '@/lib/api'

// Progresso fixo da landing (não evolui automaticamente por data)
const FIXED_PROGRESS = 63

export default function LandingPage() {
  const [progress, setProgress] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const [email, setEmail] = useState('')
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [subscribeError, setSubscribeError] = useState('')

  useEffect(() => {
    setMounted(true)
    const p = FIXED_PROGRESS
    setProgress(p)
    // Anima a barra suavemente ao carregar
    const timeout = setTimeout(() => setAnimatedProgress(p), 200)
    return () => clearTimeout(timeout)
  }, [])

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || subscribeLoading) return
    setSubscribeLoading(true)
    setSubscribeError('')
    try {
      await transmissao.inscrever(email, 'landing')
      setSubscribed(true)
      setEmail('')
      setTimeout(() => setSubscribed(false), 5000)
    } catch (error) {
      setSubscribeError(error instanceof Error ? error.message : 'Não foi possível realizar a inscrição agora')
    } finally {
      setSubscribeLoading(false)
    }
  }

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Background: imagem de corrida full-screen */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/healthy-lifestyle-running-outdoors.jpg)' }}
      />
      {/* Overlay escuro para legibilidade */}
      <div className="absolute inset-0 bg-slate-900/70" />
      {/* Gradiente sutil de rodapé */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-900/80 to-transparent" />
      {/* Glow animado sobre o sol — posicionado no centro-alto da imagem */}
      <div
        className="absolute z-10 rounded-full pointer-events-none"
        style={{
          top: '28%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '320px',
          height: '320px',
          background: 'radial-gradient(circle, rgba(251,140,0,0.35) 0%, rgba(244,90,6,0.15) 40%, transparent 70%)',
          animation: 'sunGlow 3s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes sunGlow {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
          50% { transform: translate(-50%, -50%) scale(1.35); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-8 py-4 md:px-16 md:py-5">
        <Image
          src="/logo-aomenos1km-branco-transparente.png"
          alt="aomenos1km"
          width={160}
          height={48}
          className="object-contain"
          priority
        />
        <Link href="/login">
          <Button className="bg-[#f45a06] hover:bg-[#e25205] text-white font-semibold px-6 py-2 inline-flex items-center gap-2">
            Entrar <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </header>

      {/* Conteúdo central */}
      <main className="relative z-20 flex flex-col items-center justify-center h-[calc(100vh-80px)] px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Eyebrow */}
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/50">
            Em construção
          </p>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight">
            Transforme Sua{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f45a06] to-orange-400">
              História
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 leading-relaxed max-w-xl mx-auto">
            A plataforma que conecta corredores, celebra conquistas e transforma comunidades através do movimento.
          </p>

          {/* Barra de progresso */}
          {mounted && (
            <div className="space-y-2 max-w-md mx-auto w-full">
              <div className="relative h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${animatedProgress}%`,
                    background: 'linear-gradient(90deg, #f45a06, #fb8c00)',
                  }}
                />
              </div>
              <p className="text-xs text-white/40 tracking-widest">{progress}% concluído</p>
            </div>
          )}

          {/* Inscrição */}
          <div className="space-y-3">
            <p className="text-sm text-white/50">Receba notícias do lançamento</p>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <div className="flex-1 relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={subscribeLoading || subscribed}
                  className="w-full pl-11 pr-4 h-10 rounded-full bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-orange-500/60 focus:bg-white/15 transition-all disabled:opacity-50 text-sm"
                />
              </div>
              <Button
                type="submit"
                disabled={!email || subscribeLoading || subscribed}
                className="bg-gradient-to-r from-[#f45a06] to-orange-500 hover:from-[#e25205] hover:to-orange-600 disabled:opacity-50 text-white font-semibold px-4 h-10 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap text-sm"
              >
                {subscribed ? (
                  <><CheckCircle className="h-4 w-4" /> Inscrito!</>
                ) : subscribeLoading ? (
                  'Aguarde...'
                ) : (
                  <><ArrowRight className="h-4 w-4" /> Inscrever</>
                )}
              </Button>
            </form>
            {subscribed && (
              <p className="text-sm text-emerald-400">Obrigado! Você receberá atualizações sobre o lançamento.</p>
            )}
            {subscribeError && <p className="text-sm text-red-300">{subscribeError}</p>}
            <div className="pt-1 space-y-1">
              <p className="text-xs uppercase tracking-wider text-white/40">Siga o movimento</p>
              <a
                href="https://instagram.com/aomenos1km"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-[#f45a06] transition-colors"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
                  <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5a4.25 4.25 0 0 0 4.25 4.25h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5a4.25 4.25 0 0 0-4.25-4.25h-8.5Zm8.9 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z" />
                </svg>
                @aomenos1km
              </a>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
