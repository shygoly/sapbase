'use client'

import { useBrandTheme } from '@/hooks/use-brand-theme'

/**
 * Component that applies brand theme to the application
 * Should be placed high in the component tree
 */
export function BrandThemeApplier() {
  useBrandTheme()
  return null
}
