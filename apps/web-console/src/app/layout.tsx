import '../styles/globals.css';

import { cookies, headers } from 'next/headers';

import { DEFAULT_THEME } from '@sap/app-shared/components/themes/theme.config';
import { fontVariables } from '@sap/app-shared/components/themes/font.config';
import { LOCALE_COOKIE, resolveLocale } from '@sap/app-shared/i18n/config';
import { AppProviders } from './providers';

export const metadata = {
  title: 'Speckit ERP',
  description: 'Speckit ERP dashboard',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3060'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
  },
  other: {
    'dns-prefetch': 'on',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
  });
  const activeTheme = cookieStore.get('active_theme')?.value ?? DEFAULT_THEME;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name='theme-color' content='hsl(var(--background))' />
        <meta
          name='theme-color'
          content='hsl(var(--background))'
          media='(prefers-color-scheme: dark)'
        />
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
      </head>
      <body className={fontVariables}>
        <AppProviders activeTheme={activeTheme} locale={locale}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
