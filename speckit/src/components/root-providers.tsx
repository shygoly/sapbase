/**
 * Root Providers Component
 * Wraps the entire app with necessary providers
 */

'use client'

import React, { useEffect } from 'react'
import { useAuthStore, usePermissionStore, useMenuStore } from '@/core/store'

interface RootProvidersProps {
  children: React.ReactNode
}

export function RootProviders({ children }: RootProvidersProps) {
  const { initializeAuth, user } = useAuthStore()
  const { setPermissions, fetchAllPermissions } = usePermissionStore()
  const { fetchFilteredMenu } = useMenuStore()

  // Initialize auth on app load
  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  // Load permissions and menu when user changes
  useEffect(() => {
    if (user && user.permissions) {
      setPermissions(user.permissions)
      fetchAllPermissions()
      fetchFilteredMenu(user.permissions)
    }
  }, [user, setPermissions, fetchAllPermissions, fetchFilteredMenu])

  return (
    <>
      {children}
    </>
  )
}
