// Root layout configuration for integrating all system providers
// This file documents how to set up the root layout with all system-level capabilities

/**
 * Update your root layout (app/layout.tsx) to use RootProviders:
 *
 * ```typescript
 * import { RootProviders } from '@/components/root-providers'
 * import { AdminLayout } from '@/components/admin-layout'
 *
 * export default function RootLayout({ children }: { children: ReactNode }) {
 *   return (
 *     <html lang="en">
 *       <body>
 *         <RootProviders>
 *           <AdminLayout>{children}</AdminLayout>
 *         </RootProviders>
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 *
 * This setup provides:
 * - Error boundary for catching React errors
 * - Error context for error logging
 * - Theme provider for light/dark mode
 * - i18n provider for translations
 * - Notification provider for toast messages
 * - Menu provider (via AdminLayout) for navigation
 * - Notification container for displaying toasts
 */

export const layoutConfig = {
  providers: [
    'ErrorBoundary',
    'ErrorProvider',
    'ThemeProvider',
    'I18nProvider',
    'NotificationProvider',
  ],
  components: ['AdminLayout', 'NotificationContainer'],
  features: [
    'Error handling and logging',
    'Theme switching (light/dark)',
    'Internationalization (i18n)',
    'Notifications/toasts',
    'Menu management',
    'Performance optimization',
  ],
}
