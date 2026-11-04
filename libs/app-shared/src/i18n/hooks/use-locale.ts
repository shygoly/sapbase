'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { defaultLocale, type Locale, isValidLocale } from '../config'

/**
 * Hook to get and set the current locale.
 * 
 * Usage:
 * ```tsx
 * const { locale, setLocale } = useLocale()
 * ```
 */
export function useLocale(): Locale {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const pathname = usePathname()

  useEffect(() => {
    // Get locale from URL path (e.g., /zh/dashboard)
    const pathSegments = (pathname ?? '').split('/').filter(Boolean)
    const pathLocale = pathSegments[0]

    if (isValidLocale(pathLocale)) {
      setLocaleState(pathLocale)
      // Also save to localStorage
      localStorage.setItem('locale', pathLocale)
    } else {
      // Try to get from localStorage
      const savedLocale = localStorage.getItem('locale')
      if (savedLocale && isValidLocale(savedLocale)) {
        setLocaleState(savedLocale)
      } else {
        // Detect from browser
        const browserLocale = navigator.language.split('-')[0]
        if (isValidLocale(browserLocale)) {
          setLocaleState(browserLocale)
        }
      }
    }
  }, [pathname])

  return locale
}

/**
 * Hook to change locale.
 */
export function useSetLocale() {
  const router = useRouter()
  const pathname = usePathname()
  useLocale()

  const setLocale = useCallback(
    (newLocale: Locale) => {
      localStorage.setItem('locale', newLocale)

      // Update URL path
      const pathSegments = (pathname ?? '').split('/').filter(Boolean)
      const firstSegment = pathSegments[0]

      if (isValidLocale(firstSegment)) {
        // Replace locale in path
        pathSegments[0] = newLocale
        router.push(`/${pathSegments.join('/')}`)
      } else {
        // Add locale to path
        router.push(`/${newLocale}${pathname}`)
      }

      // Reload to apply new locale
      router.refresh()
    },
    [pathname, router],
  )

  return setLocale
}
