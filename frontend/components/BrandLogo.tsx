"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  className?: string
  imageClassName?: string
  compact?: boolean
}

export default function BrandLogo({ className, imageClassName, compact = false }: BrandLogoProps) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [src, setSrc] = useState('/logo-aomenos1km.png')
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  useEffect(() => {
    if (!mounted) return
    const isDark = theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark')
    setSrc(isDark ? '/logo-aomenos1km-branco-transparente.png' : '/logo-aomenos1km.png')
  }, [theme, resolvedTheme, mounted])

  const wrapperSize = compact ? 'h-[52px] w-[132px]' : 'h-[86px] w-[220px]'

  return (
    <div className={cn('relative', wrapperSize, className)}>
      <Image
        src={src}
        alt="Aomenos1km"
        fill
        sizes={compact ? '132px' : '220px'}
        priority
        onError={() => setSrc('/logo-aomenos1km.svg')}
        className={cn('object-contain', imageClassName)}
      />
    </div>
  )
}
