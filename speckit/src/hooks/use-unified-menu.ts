import { useState, useEffect } from 'react'
import { UnifiedMenuItem, MenuState } from '@/types/navigation'
import { adaptBackendMenuToUnified, flattenMenuItems } from '@/lib/menu-adapter'
import { useUserPermissions } from '@/core/auth/permission-hooks'
import { useAuthStore, usePermissionStore } from '@/core/store'
import { menuApi } from '@/lib/api/menu.api'

const PLUGINS_PATH = '/admin/plugins'
const WORKFLOW_PATH = '/admin/workflows'
const BRAND_CONFIG_PATH = '/admin/organization/brand-config'

const FALLBACK_MENU_ITEMS: UnifiedMenuItem[] = [
  {
    id: 'admin-plugins',
    label: '插件管理',
    path: PLUGINS_PATH,
    icon: 'settings',
    order: 7,
    permissions: ['admin', 'system:manage', 'plugins:read'],
    visible: true,
    disabled: false,
  },
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

/** Only the dedicated "系统管理" / "System Management" group gets fallback items (plugins, workflow, brand). Avoid injecting into "AI管理" etc. */
function isSystemManagementRoot(root: UnifiedMenuItem): boolean {
  const id = (root.id ?? '').toLowerCase()
  const label = (root.label ?? '').trim().toLowerCase()
  if (id === 'admin' || id === 'system-management' || id === 'system_management') return true
  if (label === '系统管理' || label === 'system management') return true
  return false
}

/** Inject 插件管理、工作流、品牌配置 when missing, only if user has system manage or plugins permission. */
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
  const permissionsReady = usePermissionStore((s) => s.permissionsReady)
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated)
  const menuSourceReady =
    options.source === 'api' || (options.source === 'static' && options.staticItems != null)

  const canBuildMenu = isLoggedIn && permissionsReady && menuSourceReady

  useEffect(() => {
    if (!canBuildMenu) {
      setState((prev) => ({
        ...prev,
        items: [],
        loading: true,
        error: null,
      }))
      return
    }

    const loadMenu = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }))

        let items: UnifiedMenuItem[] = []

        if (options.source === 'static' && options.staticItems) {
          items = options.staticItems
        } else {
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
  }, [canBuildMenu, options.source, options.staticItems, permissions, isLoggedIn, menuSourceReady, permissionsReady])

  return state
}
