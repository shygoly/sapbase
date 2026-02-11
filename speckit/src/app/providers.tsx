'use client';

import React from 'react';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { ActiveThemeProvider } from '@/components/themes/active-theme';
import ThemeProvider from '@/components/themes/theme-provider';
import { RootProviders } from '@/components/root-providers';

export function AppProviders({
  children,
  activeTheme
}: {
  children: React.ReactNode;
  activeTheme?: string;
}) {
  return (
    <ThemeProvider
      attribute='class'
      defaultTheme='system'
      enableSystem
      disableTransitionOnChange
    >
      <ActiveThemeProvider initialTheme={activeTheme}>
        <NuqsAdapter>
          <RootProviders>
            <NextTopLoader
              color='hsl(var(--primary))'
              showSpinner={false}
              shadow={false}
            />
            {children}
          </RootProviders>
        </NuqsAdapter>
      </ActiveThemeProvider>
    </ThemeProvider>
  );
}

