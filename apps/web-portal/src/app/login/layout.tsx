/**
 * Login Layout
 * Simple layout for login page without sidebar
 */

import { NotificationContainer } from '@sap/app-shared/components/notification-container'

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificationContainer />
      {children}
    </>
  )
}
