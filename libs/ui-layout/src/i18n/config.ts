/**
 * i18n configuration
 */

export const locales = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

/** 语言偏好 cookie。命名与 next-intl 保持一致，便于后续平滑迁移。 */
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
}

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
}

/**
 * Check if a locale is valid
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale)
}

/**
 * 从 Accept-Language 协商出最合适的支持语言。
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale
  const languages = acceptLanguage
    .split(',')
    .map((lang) => lang.split(';')[0]?.trim().toLowerCase())
    .filter(Boolean)

  for (const lang of languages) {
    const locale = lang.split('-')[0] as Locale
    if (isValidLocale(locale)) {
      return locale
    }
  }
  return defaultLocale
}

/**
 * 请求级 locale 解析。
 *
 * 当前顺序：合法 override → cookie → Accept-Language → default。
 * 用户 / 组织偏好落地后，应在 cookie 之前插入，保持这里为唯一入口。
 */
export function resolveLocale(input: {
  override?: string | null
  cookie?: string | null
  acceptLanguage?: string | null
}): Locale {
  if (input.override && isValidLocale(input.override)) return input.override
  if (input.cookie && isValidLocale(input.cookie)) return input.cookie
  return negotiateLocale(input.acceptLanguage)
}

/**
 * Get locale from request headers or default
 */
export function getLocaleFromHeaders(headers: Headers): Locale {
  return negotiateLocale(headers.get('accept-language'))
}
