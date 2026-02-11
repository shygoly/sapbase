'use client'

import { useContext, useCallback } from 'react'
import { I18nContext } from './context'
import type { Language } from './config'

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}

export function useTranslation() {
  const { language, translations } = useI18n()

  const t = useCallback(
    (key: string, defaultValue?: string): string => {
      const keys = key.split('.')
      let value: any = translations

      for (const k of keys) {
        value = value?.[k]
      }

      return typeof value === 'string' ? value : defaultValue || key
    },
    [translations]
  )

  return { t, language }
}
