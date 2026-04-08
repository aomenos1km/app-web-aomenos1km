import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/publico']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Permite rotas públicas e arquivos estáticos
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // O JWT é guardado em sessionStorage (client-side) — o middleware não 
  // tem acesso direto. Usamos um cookie leve apenas para o middleware.
  const token = req.cookies.get('auth_token')?.value

  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next()
  }

  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
