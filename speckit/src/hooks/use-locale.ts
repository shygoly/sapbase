'use client'

import { usePathname } from 'next/navigation'
import { locales, defaultLocale, type Locale } from '@/i18n/config'

/**
 * Returns the current locale from the pathname (e.g. /en/admin/users -> 'en').
 * Use when inside [locale] layout. For paths without locale, returns defaultLocale.
 */
export function useLocale(): Locale {
  const pathname = usePathname()
  const segment = pathname?.split('/')[1]
  return (segment && (locales as readonly string[]).includes(segment) ? segment : defaultLocale) as Locale
}

/**
 * Returns a function that prefixes a path with the current locale.
 * Use for Link href and router.push when the path is under [locale] (e.g. /admin/users -> /en/admin/users).
 * Paths that already start with locale or are external are returned unchanged.
 */
export function useLocalePrefix(): (path: string) => string {
  const locale = useLocale()
  return (path: string) => {
    if (!path || !path.startsWith('/')) return path
    const segments = path.split('/').filter(Boolean)
    if (segments.length > 0 && (locales as readonly string[]).includes(segments[0])) return path
    return `/${locale}${path}`
  }
}
