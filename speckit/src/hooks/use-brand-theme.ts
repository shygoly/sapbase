'use client'

import { useEffect } from 'react'
import { useBrandConfig } from '@/contexts/brand-config-context'

/**
 * Hook to apply brand theme to CSS variables
 */
export function useBrandTheme() {
  const { config } = useBrandConfig()

  useEffect(() => {
    if (!config?.theme) {
      return
    }

    const root = document.documentElement
    const theme = config.theme

    // Apply theme colors as CSS variables
    root.style.setProperty('--brand-primary', theme.primary)
    root.style.setProperty('--brand-secondary', theme.secondary)
    root.style.setProperty('--brand-accent', theme.accent)
    root.style.setProperty('--brand-background', theme.background)
    root.style.setProperty('--brand-foreground', theme.foreground)

    // Apply custom CSS if provided
    if (config.customCss) {
      const styleId = 'brand-custom-css'
      let styleElement = document.getElementById(styleId) as HTMLStyleElement

      if (!styleElement) {
        styleElement = document.createElement('style')
        styleElement.id = styleId
        document.head.appendChild(styleElement)
      }

      styleElement.textContent = config.customCss
    }

    // Update favicon if provided
    if (config.faviconUrl) {
      const faviconId = 'brand-favicon'
      let faviconLink = document.getElementById(faviconId) as HTMLLinkElement

      if (!faviconLink) {
        faviconLink = document.createElement('link')
        faviconLink.id = faviconId
        faviconLink.rel = 'icon'
        document.head.appendChild(faviconLink)
      }

      faviconLink.href = config.faviconUrl
    }

    // Cleanup function
    return () => {
      // Remove custom CSS
      const styleElement = document.getElementById('brand-custom-css')
      if (styleElement) {
        styleElement.remove()
      }
    }
  }, [config])
}
