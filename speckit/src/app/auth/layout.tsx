/**
 * Auth Layout
 * Layout for authentication pages (sign-in, sign-up)
 */

import { NotificationContainer } from '@/components/notification-container'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificationContainer />
      {children}
    </>
  )
}
