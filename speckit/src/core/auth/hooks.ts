'use client'

import { useAuth } from '@/core/auth/context'

export function usePermission() {
  const { user } = useAuth()
  const hasPermission = (permission: string): boolean => {
    if (!user?.permissions) return false
    return user.permissions.includes(permission)
  }
  return { hasPermission }
}
