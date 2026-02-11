'use client'

import { useAuth } from '@/core/auth/context'

export { useAuth }

export function usePermission() {
  const { user } = useAuth()

  const hasPermission = (permission: string): boolean => {
    if (!user?.permissions) return false
    return user.permissions.includes(permission)
  }

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user?.permissions) return false
    return permissions.some(p => user.permissions.includes(p))
  }

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!user?.permissions) return false
    return permissions.every(p => user.permissions.includes(p))
  }

  return { hasPermission, hasAnyPermission, hasAllPermissions }
}
