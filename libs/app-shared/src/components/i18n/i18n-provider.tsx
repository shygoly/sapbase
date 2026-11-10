'use client'

import React, { createContext, useCallback, useContext, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { messages, type Messages } from '../../i18n/messages'
import { isValidLocale, LOCALE_COOKIE, type Locale } from '../../i18n/config'

interface I18nContextType {
  locale: Locale
  messages: Messages
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

/**
 * Provider for i18n context.
 *
 * locale 由服务端按请求解析后传入；切换语言只写 `NEXT_LOCALE` cookie 并刷新，
 * URL 保持不变。
 */
export function I18nProvider({
  children,
  locale: initialLocale = 'en',
}: {
  children: React.ReactNode
  locale?: Locale
}) {
  const router = useRouter()

  // 一次性迁移：旧版本只把语言存在 localStorage，没有 cookie。
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.cookie.includes(`${LOCALE_COOKIE}=`)) return

    const saved = window.localStorage.getItem('locale')
    if (!saved || !isValidLocale(saved)) return

    document.cookie = `${LOCALE_COOKIE}=${saved}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }, [router])

  const setLocale = useCallback(
    (newLocale: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${newLocale}; path=/; max-age=31536000; samesite=lax`
      router.refresh()
    },
    [router],
  )

  return (
    <I18nContext.Provider
      value={{
        locale: initialLocale,
        messages: messages[initialLocale],
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
