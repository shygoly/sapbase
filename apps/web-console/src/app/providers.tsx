'use client';

import React from 'react';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { ActiveThemeProvider } from '@sap/app-shared/components/themes/active-theme';
import ThemeProvider from '@sap/app-shared/components/themes/theme-provider';
import { RootProviders } from '@sap/app-shared/components/root-providers';
import { I18nProvider } from '@sap/app-shared/components/i18n/i18n-provider';
import { BrandConfigProvider } from '@sap/app-shared/contexts/brand-config-context';
import { BrandThemeApplier } from '@sap/app-shared/components/brand/brand-theme-applier';
import { PluginRuntimeProvider } from '@sap/app-shared/core/plugins/plugin-runtime';
import { NotificationContainer } from '@sap/app-shared/components/notification-container';
import type { Locale } from '@sap/app-shared/i18n/config';

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
                  <NotificationContainer />
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

