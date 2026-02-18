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
  const { initializeAuth, user, isLoading } = useAuthStore()
  const { setPermissions, fetchAllPermissions } = usePermissionStore()
  const { fetchFilteredMenu } = useMenuStore()
  const [isInitialized, setIsInitialized] = React.useState(false)

  // Initialize auth on app load - only once
  useEffect(() => {
    let mounted = true
    initializeAuth()
      .then(() => {
        if (mounted) {
          setIsInitialized(true)
        }
      })
      .catch((error) => {
        console.error('Failed to initialize auth:', error)
        if (mounted) {
          setIsInitialized(true) // Still set initialized even on error
        }
      })
    
    return () => {
      mounted = false
    }
  }, []) // Empty deps - only run once on mount

  // Load permissions and menu when user changes
  useEffect(() => {
    if (user && user.permissions) {
      setPermissions(user.permissions)
      fetchAllPermissions()
      fetchFilteredMenu(user.permissions)
    }
  }, [user, setPermissions, fetchAllPermissions, fetchFilteredMenu])

  // Show loading state during initial auth check
  if (!isInitialized || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {children}
    </>
  )
}
