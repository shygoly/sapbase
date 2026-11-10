'use client'

import { usePathname } from 'next/navigation'
import {
  defaultLocale,
  isValidLocale,
  LOCALE_COOKIE,
  type Locale,
} from '../i18n/config'

function readLocaleCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`),
  )
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

/**
 * 当前 locale：路径第一段（迁移期兼容）→ NEXT_LOCALE cookie → 默认值。
 */
export function useLocale(): Locale {
  const pathname = usePathname()
  const segment = pathname?.split('/')[1]

  if (segment && isValidLocale(segment)) return segment

  const cookie = readLocaleCookie()
  if (cookie && isValidLocale(cookie)) return cookie

  return defaultLocale
}
