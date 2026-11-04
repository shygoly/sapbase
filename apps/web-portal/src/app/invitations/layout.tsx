/**
 * Invitations Layout
 * Layout for invitation acceptance pages
 */

import { NotificationContainer } from '@sap/app-shared/components/notification-container'

export default function InvitationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificationContainer />
      {children}
    </>
  )
}
