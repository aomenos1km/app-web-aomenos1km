'use client'

import { useEffect } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERVAL_MS = 10 * 60 * 1000 // 10 minutos

/**
 * Mantém o backend do Render "aquecido" enviando um ping
 * ao /health a cada 10 minutos para evitar cold starts.
 * Não renderiza nada visualmente.
 */
export default function KeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch(`${API_BASE}/health`, { method: 'GET', cache: 'no-store' }).catch(() => {
        // silencia erros; o objetivo é apenas manter vivo
      })
    }

    // Ping imediato ao carregar a página
    ping()

    const id = setInterval(ping, INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return null
}
