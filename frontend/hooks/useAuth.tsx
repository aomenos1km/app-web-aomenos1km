'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { auth, LoginResponse } from '@/lib/api'

interface AuthUser {
  id: string
  nome: string
  perfil: string
  token: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (loginVal: string, senha: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null

  const token = sessionStorage.getItem('token')
  const nome = sessionStorage.getItem('nome')
  const perfil = sessionStorage.getItem('perfil')
  const id = sessionStorage.getItem('user_id')

  if (!token || !nome || !perfil || !id) return null
  return { token, nome, perfil, id }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser)
  const [loading] = useState(false)

  async function login(loginVal: string, senha: string) {
    const res = await auth.login(loginVal, senha)
    const { token, nome, perfil, id } = res.data as LoginResponse

    sessionStorage.setItem('token', token)
    sessionStorage.setItem('nome', nome)
    sessionStorage.setItem('perfil', perfil)
    sessionStorage.setItem('user_id', id)

    setUser({ token, nome, perfil, id })
  }

  function logout() {
    sessionStorage.clear()
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.perfil === 'Admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
