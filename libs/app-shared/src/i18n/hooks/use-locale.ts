'use client'

import { useI18n } from '../../components/i18n/i18n-provider'
import type { Locale } from '../config'

/**
 * 当前 locale 来自 I18nProvider（服务端按请求解析后传入）。
 */
export function useLocale(): Locale {
  return useI18n().locale
}

/**
 * 切换语言。
 *
 * 行为由 Provider 统一处理：
 *  - 路径仍带 `/{locale}` 时替换 URL 段（Console 迁移窗口期）；
 *  - 路径已去前缀时写 `NEXT_LOCALE` cookie 并刷新（Portal）。
 */
export function useSetLocale(): (locale: Locale) => void {
  return useI18n().setLocale
}
