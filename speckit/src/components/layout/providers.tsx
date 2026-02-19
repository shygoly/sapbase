'use client';

import React from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';
import { RootProviders } from '../root-providers';
import { NotificationContainer } from '../notification-container';

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        <RootProviders>
          <NotificationContainer />
          {children}
        </RootProviders>
      </ActiveThemeProvider>
    </>
  );
}
