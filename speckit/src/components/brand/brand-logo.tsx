'use client'

import Image from 'next/image'
import { useBrandConfig } from '@/contexts/brand-config-context'

interface BrandLogoProps {
  className?: string
  width?: number
  height?: number
  fallback?: React.ReactNode
}

/**
 * Component that displays the organization's brand logo
 */
export function BrandLogo({ className, width = 120, height = 40, fallback }: BrandLogoProps) {
  const { config } = useBrandConfig()

  if (config?.logoUrl) {
    return (
      <Image
        src={config.logoUrl}
        alt={config.appName || 'Logo'}
        width={width}
        height={height}
        className={className}
        priority
      />
    )
  }

  if (fallback) {
    return <>{fallback}</>
  }

  // Default logo
  return (
    <div className={className} style={{ width, height }}>
      <span className="text-xl font-bold">{config?.appName || 'Speckit'}</span>
    </div>
  )
}
