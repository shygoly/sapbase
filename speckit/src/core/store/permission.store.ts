/**
 * Permission Store - Zustand
 * Manages user permissions and role-based access control
 */

import { create } from 'zustand'
import { Permission, PermissionString } from '@/lib/api/types'
import { permissionsApi } from '@/lib/api/permissions.api'

interface PermissionState {
  permissions: string[]
  allPermissions: Permission[]
  isLoading: boolean
  error: string | null

  // Actions
  setPermissions: (permissions: string[]) => void
  setAllPermissions: (permissions: Permission[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  canPerformAction: (resource: string, action: string) => boolean
  fetchAllPermissions: () => Promise<void>
  clearPermissions: () => void
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: [],
  allPermissions: [],
  isLoading: false,
  error: null,

  setPermissions: (permissions) => set({ permissions }),

  setAllPermissions: (allPermissions) => set({ allPermissions }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  hasPermission: (permission: string) => {
    const { permissions } = get()
    return permissions.includes(permission)
  },

  hasAnyPermission: (permissionList: string[]) => {
    const { permissions } = get()
    return permissionList.some((p) => permissions.includes(p))
  },

  hasAllPermissions: (permissionList: string[]) => {
    const { permissions } = get()
    return permissionList.every((p) => permissions.includes(p))
  },

  canPerformAction: (resource: string, action: string) => {
    const { permissions } = get()
    const permissionString: PermissionString = `${resource}:${action}` as PermissionString
    return permissions.includes(permissionString)
  },

  fetchAllPermissions: async () => {
    set({ isLoading: true, error: null })
    try {
      const permissions = await permissionsApi.findAll()
      set({
        allPermissions: permissions,
        isLoading: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch permissions'
      set({
        error: message,
        isLoading: false,
      })
    }
  },

  clearPermissions: () => {
    set({
      permissions: [],
      allPermissions: [],
      error: null,
    })
  },
}))
