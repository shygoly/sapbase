'use client';

import React from 'react';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { ActiveThemeProvider } from '@/components/themes/active-theme';
import ThemeProvider from '@/components/themes/theme-provider';
import { RootProviders } from '@/components/root-providers';
import { I18nProvider } from '@/components/i18n/i18n-provider';
import { BrandConfigProvider } from '@/contexts/brand-config-context';
import { BrandThemeApplier } from '@/components/brand/brand-theme-applier';
import { PluginRuntimeProvider } from '@/core/plugins/plugin-runtime';
import type { Locale } from '@/i18n/config';

export function AppProviders({
  children,
  activeTheme,
  locale = 'en'
}: {
  children: React.ReactNode;
  activeTheme?: string;
  locale?: Locale;
}) {
  return (
    <I18nProvider locale={locale}>
      <ThemeProvider
        attribute='class'
        defaultTheme='system'
        enableSystem
        disableTransitionOnChange
      >
        <ActiveThemeProvider initialTheme={activeTheme}>
          <BrandConfigProvider>
            <BrandThemeApplier />
            <PluginRuntimeProvider>
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
            </PluginRuntimeProvider>
          </BrandConfigProvider>
        </ActiveThemeProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

