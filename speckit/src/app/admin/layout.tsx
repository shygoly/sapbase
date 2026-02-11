/**
 * Admin Layout
 * Shared layout for all admin pages
 * Uses LayoutRuntimeAdapter to integrate template layout with Speckit Runtime
 */

'use client'

import React from 'react'
import { LayoutRuntimeAdapter } from '@/layouts/layout-runtime-adapter'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Require admin access: user must have at least one of these permissions
  return (
    <LayoutRuntimeAdapter
      requiredPermissions={['users:read', 'roles:read']}
      requireAll={false}
    >
      {children}
    </LayoutRuntimeAdapter>
  )
}
