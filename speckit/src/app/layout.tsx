import '../styles/globals.css';
import { cookies } from 'next/headers';

import { DEFAULT_THEME } from '@/components/themes/theme.config';
import { fontVariables } from '@/components/themes/font.config';
import { AppProviders } from './providers';

export const metadata = {
  title: 'Speckit ERP',
  description: 'Speckit ERP dashboard'
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const activeTheme = cookieStore.get('active_theme')?.value ?? DEFAULT_THEME;

  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <meta name='theme-color' content='hsl(var(--background))' />
        <meta
          name='theme-color'
          content='hsl(var(--background))'
          media='(prefers-color-scheme: dark)'
        />
      </head>
      <body className={fontVariables}>
        <AppProviders activeTheme={activeTheme}>{children}</AppProviders>
      </body>
    </html>
  );
}
