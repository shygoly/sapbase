import { isValidLocale, locales, type Locale } from './config'

export interface LocaleRoutingDecision {
  action: 'next' | 'redirect'
  pathname?: string
  search?: string
  locale?: Locale
  setCookie?: boolean
}

const localePattern = new RegExp(`^/(${locales.join('|')})(?=/|$)`)
const skipPrefixes = ['/_next', '/api', '/plugins', '/images']
const skipExact = new Set(['/favicon.ico', '/robots.txt', '/sitemap.xml'])

export function shouldSkipLocaleRouting(pathname: string): boolean {
  return (
    skipPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    skipExact.has(pathname)
  )
}

/**
 * 纯函数：根据 pathname / query 决定是否重定向、是否写 locale cookie。
 *
 * 两个 app 的 middleware 共用，避免规则漂移。
 */
export function resolveLocaleRouting(input: {
  pathname: string
  searchParams: URLSearchParams
  canonical?: Record<string, string>
}): LocaleRoutingDecision {
  const { pathname, searchParams, canonical = {} } = input

  if (shouldSkipLocaleRouting(pathname)) {
    return { action: 'next' }
  }

  const lang = searchParams.get('lang')
  if (lang) {
    const next = new URLSearchParams(searchParams)
    next.delete('lang')
    const valid = isValidLocale(lang)
    return {
      action: 'redirect',
      pathname,
      search: next.toString(),
      locale: valid ? lang : undefined,
      setCookie: valid,
    }
  }

  const canonicalTarget = canonical[pathname]
  if (canonicalTarget) {
    return {
      action: 'redirect',
      pathname: canonicalTarget,
      search: searchParams.toString(),
    }
  }

  const match = pathname.match(localePattern)
  if (match) {
    const locale = match[1] ?? ''
    const valid = isValidLocale(locale)
    return {
      action: 'redirect',
      pathname: pathname.replace(localePattern, '') || '/',
      search: searchParams.toString(),
      locale: valid ? locale : undefined,
      setCookie: valid,
    }
  }

  return { action: 'next' }
}
