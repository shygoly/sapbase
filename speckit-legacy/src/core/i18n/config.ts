// i18n configuration

export const SUPPORTED_LANGUAGES = {
  en: 'English',
  'zh-CN': '中文',
} as const

export type Language = keyof typeof SUPPORTED_LANGUAGES

export const DEFAULT_LANGUAGE: Language = 'en'

export interface i18nConfig {
  defaultLanguage: Language
  supportedLanguages: Language[]
  fallbackLanguage: Language
}

export const i18nConfig: i18nConfig = {
  defaultLanguage: DEFAULT_LANGUAGE,
  supportedLanguages: Object.keys(SUPPORTED_LANGUAGES) as Language[],
  fallbackLanguage: 'en',
}
