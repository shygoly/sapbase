'use client'

import React, { createContext, useState, useEffect, ReactNode } from 'react'
import type { Language } from './config'

export interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  translations: Record<string, any>
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined)

interface I18nProviderProps {
  children: ReactNode
  defaultLanguage?: Language
}

export function I18nProvider({ children, defaultLanguage = 'en' }: I18nProviderProps) {
  const [language, setLanguage] = useState<Language>(defaultLanguage)
  const [translations, setTranslations] = useState<Record<string, any>>({})

  useEffect(() => {
    loadTranslations(language)
  }, [language])

  const loadTranslations = async (lang: Language) => {
    try {
      const response = await import(`./translations/${lang}.json`)
      setTranslations(response.default)
    } catch (error) {
      return
    }
  }

  return React.createElement(
    I18nContext.Provider,
    { value: { language, setLanguage, translations } },
    children
  )
}
