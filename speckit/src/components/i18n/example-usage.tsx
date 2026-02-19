'use client'

/**
 * Example component showing how to use i18n.
 * This file demonstrates best practices for internationalization.
 */

import { useTranslation } from '@/i18n'
import { useLocale, useSetLocale } from '@/i18n'
import { LanguageSwitcher } from './language-switcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Example: Basic translation usage
 */
export function BasicTranslationExample() {
  const t = useTranslation()

  return (
    <div>
      <h1>{t('common.appName')}</h1>
      <p>{t('common.appDescription')}</p>
      <Button>{t('common.save')}</Button>
    </div>
  )
}

/**
 * Example: Translation with parameters
 */
export function TranslationWithParamsExample() {
  const t = useTranslation()

  return (
    <div>
      {/* If translation has {{name}} placeholder */}
      <p>{t('common.welcome', { name: 'John' })}</p>
    </div>
  )
}

/**
 * Example: Language switcher integration
 */
export function LanguageSwitcherExample() {
  const locale = useLocale()
  const setLocale = useSetLocale()
  const t = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('common.appName')}</CardTitle>
        <CardDescription>
          Current language: {locale}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <LanguageSwitcher />
          
          <div className="flex gap-2">
            <Button onClick={() => setLocale('en')}>
              English
            </Button>
            <Button onClick={() => setLocale('zh')}>
              中文
            </Button>
            <Button onClick={() => setLocale('ja')}>
              日本語
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Example: Conditional translations
 */
export function ConditionalTranslationExample() {
  const t = useTranslation()
  const isLoading = false

  return (
    <div>
      {isLoading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <p>{t('common.success')}</p>
      )}
    </div>
  )
}

/**
 * Example: Form with translations
 */
export function FormTranslationExample() {
  const t = useTranslation()

  return (
    <form>
      <label>{t('auth.email')}</label>
      <input type="email" />
      
      <label>{t('auth.password')}</label>
      <input type="password" />
      
      <Button type="submit">
        {t('auth.login')}
      </Button>
    </form>
  )
}
