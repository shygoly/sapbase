'use client'

import { useLocale, useSetLocale } from '@/i18n'
import { locales, localeNames, localeFlags } from '@/i18n/config'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Globe } from 'lucide-react'

/**
 * Language switcher component.
 * 
 * Usage:
 * ```tsx
 * <LanguageSwitcher />
 * ```
 */
export function LanguageSwitcher() {
  const locale = useLocale()
  const setLocale = useSetLocale()

  return (
    <Select value={locale} onValueChange={setLocale}>
      <SelectTrigger className="w-[140px]">
        <Globe className="mr-2 h-4 w-4" />
        <SelectValue>
          <span className="flex items-center gap-2">
            <span>{localeFlags[locale]}</span>
            <span>{localeNames[locale]}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            <span className="flex items-center gap-2">
              <span>{localeFlags[loc]}</span>
              <span>{localeNames[loc]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Compact language switcher (icon only).
 */
export function LanguageSwitcherCompact() {
  const locale = useLocale()
  const setLocale = useSetLocale()

  return (
    <Select value={locale} onValueChange={setLocale}>
      <SelectTrigger className="w-auto h-9 px-2">
        <span className="text-lg">{localeFlags[locale]}</span>
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            <span className="flex items-center gap-2">
              <span>{localeFlags[loc]}</span>
              <span>{localeNames[loc]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
