import { messages } from '@/i18n/messages'
import type { Locale } from '@/i18n/config'

/**
 * Get translation function for server components.
 * 
 * Usage:
 * ```tsx
 * const t = getTranslations('en')
 * const text = t('common.appName')
 * ```
 */
export function getTranslations(locale: Locale = 'en') {
  const translations = messages[locale] || messages.en

  return (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: any = translations

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k as keyof typeof value]
      } else {
        return key
      }
    }

    if (typeof value !== 'string') {
      return key
    }

    // Replace parameters
    if (params) {
      return Object.entries(params).reduce(
        (str, [paramKey, paramValue]) =>
          str.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue)),
        value,
      )
    }

    return value
  }
}

/**
 * Get nested translation value.
 */
export function getNestedTranslation(
  obj: any,
  path: string,
  defaultValue?: string,
): string {
  const keys = path.split('.')
  let value: any = obj

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      return defaultValue || path
    }
  }

  return typeof value === 'string' ? value : defaultValue || path
}
