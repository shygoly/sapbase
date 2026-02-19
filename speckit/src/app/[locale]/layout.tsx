import '../../styles/globals.css'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { DEFAULT_THEME } from '@/components/themes/theme.config'
import { AppProviders } from '../providers'
import { locales, type Locale, isValidLocale } from '@/i18n/config'
import { messages } from '@/i18n/messages'

export const metadata = {
  title: 'Speckit ERP',
  description: 'Speckit ERP dashboard',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
  },
}

export const revalidate = 3600

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = localeParam as Locale

  if (!isValidLocale(locale)) {
    notFound()
  }

  const cookieStore = await cookies()
  const activeTheme = cookieStore.get('active_theme')?.value ?? DEFAULT_THEME

  // Validate that messages exist for this locale (fallback handled by caller/default)
  if (!messages[locale]) {
    // locale not in messages; caller may use default
  }

  return (
    <AppProviders activeTheme={activeTheme} locale={locale}>
      {children}
    </AppProviders>
  )
}
