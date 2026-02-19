import { useState, useEffect } from 'react'
import { UnifiedMenuItem, MenuState } from '@/types/navigation'
import { adaptBackendMenuToUnified, flattenMenuItems } from '@/lib/menu-adapter'
import { useUserPermissions } from '@/core/auth/permission-hooks'
import { useAuthStore } from '@/core/store'
import { menuApi } from '@/lib/api/menu.api'

const WORKFLOW_PATH = '/admin/workflows'
const BRAND_CONFIG_PATH = '/admin/organization/brand-config'

const FALLBACK_MENU_ITEMS: UnifiedMenuItem[] = [
  {
    id: 'admin-workflows',
    label: '工作流',
    path: WORKFLOW_PATH,
    icon: 'workflow',
    order: 8,
    permissions: ['admin', 'system:manage'],
    visible: true,
    disabled: false,
  },
  {
    id: 'admin-brand-config',
    label: '品牌配置',
    path: BRAND_CONFIG_PATH,
    icon: 'settings',
    order: 9,
    permissions: ['admin', 'system:manage'],
    visible: true,
    disabled: false,
  },
]

/** Normalize path for comparison (leading slash, no trailing slash). */
function normPath(p: string | undefined): string {
  const s = (p || '').trim().replace(/^\/+|\/+$/g, '')
  return s ? '/' + s : ''
}

function hasSystemManagePermission(userPermissions: string[]): boolean {
  const lower = userPermissions.map((p) => (p || '').toLowerCase())
  return (
    lower.includes('system:manage') ||
    lower.includes('admin') ||
    lower.includes('system:admin')
  )
}

function isSystemManagementRoot(root: UnifiedMenuItem): boolean {
  const children = root.children ?? []
  const hasAdminChild = children.some((c) => normPath(c.path).includes('/admin'))
  if (hasAdminChild) return true
  const label = (root.label ?? '').toLowerCase()
  return (
    label.includes('system management') ||
    label.includes('系统管理') ||
    label.includes('管理') ||
    label.includes('admin')
  )
}

/** Ensure 工作流 and 品牌配置 are present under System Management if user has permission and API didn't return them. */
function ensureFallbackMenuItems(items: UnifiedMenuItem[], userPermissions: string[]): UnifiedMenuItem[] {
  if (!hasSystemManagePermission(userPermissions)) return items

  const flat = flattenMenuItems(items)
  const toInject = FALLBACK_MENU_ITEMS.filter(
    (item) => !flat.some((f) => normPath(f.path) === normPath(item.path)),
  )
  if (toInject.length === 0) return items

  let injected = false
  const newItems = items.map((root) => {
    if (!isSystemManagementRoot(root)) return root
    const children = root.children ?? []
    const existingPaths = new Set(children.map((c) => normPath(c.path)))
    const newChildren = toInject.filter(
      (item) => item.path && !existingPaths.has(normPath(item.path)),
    )
    if (newChildren.length === 0) return root
    injected = true
    return {
      ...root,
      children: [...children, ...newChildren].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }
  })

  if (!injected && toInject.length > 0) {
    newItems.push({
      id: 'admin-fallback-root',
      label: '系统管理',
      icon: 'settings',
      order: 99,
      children: [...toInject].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    })
  }

  return newItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    const loadMenu = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }))

        let items: UnifiedMenuItem[] = []

        if (options.source === 'static' && options.staticItems) {
          items = options.staticItems
        } else if (options.source === 'api') {
          // Wait for auth so permissions are set; avoid loading with empty permissions
          if (!isAuthenticated) {
            setState((prev) => ({ ...prev, items: [], loading: false }))
            return
          }
          const menuItems = await menuApi.findAll()
          items = adaptBackendMenuToUnified(menuItems, permissions)
          items = ensureFallbackMenuItems(items, permissions)
        }

        setState((prev) => ({
          ...prev,
          items,
          loading: false,
        }))
      } catch (error) {
        // On API error, still show 工作流 and 品牌配置 if user has permission so they can navigate
        let fallbackItems: UnifiedMenuItem[] = []
        if (options.source === 'api' && hasSystemManagePermission(permissions)) {
          fallbackItems = [
            {
              id: 'admin-fallback-root',
              label: '系统管理',
              icon: 'settings',
              order: 99,
              children: [...FALLBACK_MENU_ITEMS].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
            },
          ]
        }
        setState((prev) => ({
          ...prev,
          items: fallbackItems,
          error: error instanceof Error ? error.message : 'Unknown error',
          loading: false,
        }))
      }
    }

    loadMenu()
  }, [options.source, options.staticItems, permissions, isAuthenticated])

  return state
}
