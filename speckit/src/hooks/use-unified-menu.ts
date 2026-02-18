import { useState, useEffect } from 'react'
import { UnifiedMenuItem, MenuState } from '@/types/navigation'
import { adaptBackendMenuToUnified } from '@/lib/menu-adapter'
import { useUserPermissions } from '@/core/auth/permission-hooks'
import { menuApi } from '@/lib/api/menu.api'

interface UseUnifiedMenuOptions {
  source: 'static' | 'api'
  staticItems?: UnifiedMenuItem[]
}

export function useUnifiedMenu(options: UseUnifiedMenuOptions): MenuState {
  const [state, setState] = useState<MenuState>({
    items: [],
    loading: true,
    error: null,
    expandedItems: new Set(),
  })

  const permissions = useUserPermissions()

  useEffect(() => {
    const loadMenu = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }))

        let items: UnifiedMenuItem[] = []

        if (options.source === 'static' && options.staticItems) {
          items = options.staticItems
        } else if (options.source === 'api') {
          const menuItems = await menuApi.findAll()
          console.log('Raw menu items from API:', menuItems)
          console.log('User permissions:', permissions)
          items = adaptBackendMenuToUnified(menuItems, permissions)
          console.log('Filtered menu items:', items)
        }

        setState((prev) => ({
          ...prev,
          items,
          loading: false,
        }))
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
          loading: false,
        }))
      }
    }

    loadMenu()
  }, [options.source, options.staticItems, permissions])

  return state
}
