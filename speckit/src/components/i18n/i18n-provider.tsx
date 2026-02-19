'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { messages, type Messages } from '@/i18n/messages'
import type { Locale } from '@/i18n/config'

interface I18nContextType {
  locale: Locale
  messages: Messages
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

/**
 * Provider for i18n context.
 */
export function I18nProvider({
  children,
  locale: initialLocale = 'en',
}: {
  children: React.ReactNode
  locale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => {
    // Sync with localStorage
    const savedLocale = localStorage.getItem('locale')
    if (savedLocale && savedLocale !== locale) {
      setLocaleState(savedLocale as Locale)
    }
  }, [locale])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
  }

  return (
    <I18nContext.Provider
      value={{
        locale,
        messages: messages[locale],
        setLocale,
      }}
    >
      {children}
    </I18nContext.Provider>
  )
}

/**
 * Hook to access i18n context.
 */
export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
