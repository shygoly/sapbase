/**
 * Menu Hooks
 * Custom hooks for menu management
 */

import { useEffect } from 'react'
import { useMenuStore } from '@/core/store'
import { usePermissionStore } from '@/core/store'

/**
 * useMenu - Get menu items
 */
export function useMenu() {
  const { items, isLoading, error } = useMenuStore()
  return { items, isLoading, error }
}

/**
 * useLoadMenu - Load menu items
 */
export function useLoadMenu() {
  const { fetchMenu, fetchFilteredMenu, isLoading } = useMenuStore()
  const { permissions } = usePermissionStore()

  useEffect(() => {
    if (permissions.length > 0) {
      fetchFilteredMenu(permissions)
    } else {
      fetchMenu()
    }
  }, [permissions, fetchMenu, fetchFilteredMenu])

  return { isLoading }
}

/**
 * useMenuItems - Get menu items with auto-load
 */
export function useMenuItems() {
  const { items, isLoading, error } = useMenuStore()
  const { permissions } = usePermissionStore()

  useEffect(() => {
    if (permissions.length > 0) {
      useMenuStore.getState().fetchFilteredMenu(permissions)
    }
  }, [permissions])

  return { items, isLoading, error }
}
