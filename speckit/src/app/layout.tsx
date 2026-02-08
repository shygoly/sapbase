import type { Metadata } from 'next'
import './globals.css'
import { RootProviders } from '@/components/root-providers'
import { AuthProvider } from '@/components/auth-provider'
import { MenuProvider } from '@/core/menu/context'

export const metadata: Metadata = {
  title: 'Speckit ERP Frontend Runtime',
  description: 'Business-Agnostic Enterprise ERP Frontend Runtime'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <RootProviders>
          <AuthProvider>
            <MenuProvider>
              <div className="min-h-screen bg-gray-50">
                {children}
              </div>
            </MenuProvider>
          </AuthProvider>
        </RootProviders>
      </body>
    </html>
  )
}
