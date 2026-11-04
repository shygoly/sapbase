'use client'

import { useMemo } from 'react'
import { useLocale } from './use-locale'
import { messages } from '../messages'
import type { Messages } from '../messages'

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`
}[keyof ObjectType & (string | number)]

type TranslationKey = NestedKeyOf<Messages>

/**
 * Hook for translations with type safety.
 * 
 * Usage:
 * ```tsx
 * const t = useTranslation()
 * <h1>{t('common.appName')}</h1>
 * ```
 */
export function useTranslation() {
  const locale = useLocale()
  const translations = messages[locale]

  const t = useMemo(
    () => (key: TranslationKey, params?: Record<string, string | number>) => {
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
    },
    [translations],
  )

  return t
}
