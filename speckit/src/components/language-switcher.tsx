'use client'

import { useI18n } from '@/core/i18n/hooks'
import { SUPPORTED_LANGUAGES } from '@/core/i18n/config'

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n()

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as any)}
      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
    >
      {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </select>
  )
}
