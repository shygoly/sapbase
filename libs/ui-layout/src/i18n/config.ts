/**
 * i18n configuration
 */

export const locales = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

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
 * Get locale from request headers or default
 */
export function getLocaleFromHeaders(headers: Headers): Locale {
  const acceptLanguage = headers.get('accept-language')
  if (acceptLanguage) {
    const languages = acceptLanguage.split(',').map((lang) => lang.split(';')[0].trim().toLowerCase())
    for (const lang of languages) {
      const locale = lang.split('-')[0] as Locale
      if (isValidLocale(locale)) {
        return locale
      }
    }
  }
  return defaultLocale
}
