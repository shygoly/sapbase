import '../styles/globals.css';

import { fontVariables } from '@/components/themes/font.config';

export const metadata = {
  title: 'Speckit ERP',
  description: 'Speckit ERP dashboard',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
  },
  other: {
    'dns-prefetch': 'on',
  },
};

export const revalidate = 3600;
export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
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
        {children}
      </body>
    </html>
  );
}
