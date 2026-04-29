import type { Metadata } from 'next'
import { Manrope, Sora } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/hooks/useAuth'
import { ThemeProvider } from '@/components/theme-provider'
import { TITLE_SITE_DEFAULT } from '@/lib/page-titles'
import KeepAlive from '@/components/KeepAlive'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
})

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-sora',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.aomenos1km.com.br'),
  title: TITLE_SITE_DEFAULT,
  description: 'Plataforma de gestão de eventos esportivos da Aomenos1km',
  icons: {
    icon: [
      { url: '/favicon.svg?v=2', type: 'image/svg+xml' },
      { url: '/icon.svg?v=2', type: 'image/svg+xml' },
      { url: '/favicon32x32.png?v=2', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.svg?v=2',
    apple: '/favicon32x32.png?v=2',
  },
  openGraph: {
    title: TITLE_SITE_DEFAULT,
    description: 'Plataforma de gestão de eventos esportivos da Aomenos1km',
    url: 'https://www.aomenos1km.com.br',
    siteName: 'Aomenos1km - Gestão de Eventos Esportivos',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: '/logo-aomenos1km.png',
        width: 1200,
        height: 630,
        alt: 'Aomenos1km - Gestão de Eventos Esportivos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE_SITE_DEFAULT,
    description: 'Plataforma de gestão de eventos esportivos da Aomenos1km',
    images: ['/logo-aomenos1km.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${manrope.variable} ${sora.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider>
          <AuthProvider>
            <KeepAlive />
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
