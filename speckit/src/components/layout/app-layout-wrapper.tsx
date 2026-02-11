'use client'

import React from 'react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { UnifiedSidebar } from './unified-sidebar'
import { UnifiedMenuItem } from '@/types/navigation'

interface AppLayoutWrapperProps {
  menuSource: 'static' | 'api'
  staticItems?: UnifiedMenuItem[]
  children: React.ReactNode
  onLogout?: () => void
}

export function AppLayoutWrapper({
  menuSource,
  staticItems,
  children,
  onLogout,
}: AppLayoutWrapperProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <UnifiedSidebar
          source={menuSource}
          staticItems={staticItems}
          onLogout={onLogout}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
