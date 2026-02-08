'use client'

import { ReactNode } from 'react'
import { I18nProvider } from '@/core/i18n/context'
import { ThemeProvider } from '@/core/theme/context'
import { ErrorProvider } from '@/core/error/context'
import { NotificationProvider } from '@/core/notification/context'
import { ErrorBoundary } from '@/components/error-boundary'
import { NotificationContainer } from '@/components/notification-container'

interface RootProvidersProps {
  children: ReactNode
}

export function RootProviders({ children }: RootProvidersProps) {
  return (
    <ErrorBoundary>
      <ErrorProvider>
        <ThemeProvider>
          <I18nProvider>
            <NotificationProvider>
              {children}
              <NotificationContainer />
            </NotificationProvider>
          </I18nProvider>
        </ThemeProvider>
      </ErrorProvider>
    </ErrorBoundary>
  )
}
