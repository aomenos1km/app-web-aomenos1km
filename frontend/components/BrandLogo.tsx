"use client"

import { useState } from 'react'
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
  const [fallbackSvg, setFallbackSvg] = useState(false)
  const isDark = theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark')
  const src = fallbackSvg
    ? '/logo-aomenos1km.svg'
    : isDark
      ? '/logo-aomenos1km-branco-transparente.png'
      : '/logo-aomenos1km.png'

  const wrapperSize = compact ? 'h-[52px] w-[132px]' : 'h-[86px] w-[220px]'

  return (
    <div className={cn('relative', wrapperSize, className)}>
      <Image
        src={src}
        alt="Aomenos1km"
        fill
        sizes={compact ? '132px' : '220px'}
        priority
        onError={() => setFallbackSvg(true)}
        className={cn('object-contain', imageClassName)}
      />
    </div>
  )
}
