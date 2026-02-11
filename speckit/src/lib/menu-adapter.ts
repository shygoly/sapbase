import { UnifiedMenuItem } from '@/types/navigation'

interface BackendMenuItem {
  id: string
  label: string
  path?: string
  icon?: string
  permissions?: string[]
  visible: boolean
  order: number
  children?: BackendMenuItem[]
}

export function adaptBackendMenuToUnified(
  items: BackendMenuItem[],
  userPermissions: string[] = [],
): UnifiedMenuItem[] {
  return items
    .filter((item) => {
      if (!item.visible) return false
      if (!item.permissions || item.permissions.length === 0) return true
      return item.permissions.some((p) => userPermissions.includes(p))
    })
    .map((item) => ({
      id: item.id,
      label: item.label,
      path: item.path,
      icon: item.icon,
      permissions: item.permissions,
      visible: item.visible,
      order: item.order,
      children: item.children
        ? adaptBackendMenuToUnified(item.children, userPermissions)
        : undefined,
    }))
    .sort((a, b) => a.order - b.order)
}

export function flattenMenuItems(items: UnifiedMenuItem[]): UnifiedMenuItem[] {
  const flattened: UnifiedMenuItem[] = []

  function flatten(items: UnifiedMenuItem[]) {
    for (const item of items) {
      flattened.push(item)
      if (item.children && item.children.length > 0) {
        flatten(item.children)
      }
    }
  }

  flatten(items)
  return flattened
}

export function findActiveMenuItem(
  items: UnifiedMenuItem[],
  pathname: string,
): UnifiedMenuItem | null {
  for (const item of items) {
    if (item.path === pathname) {
      return item
    }
    if (item.children) {
      const found = findActiveMenuItem(item.children, pathname)
      if (found) return found
    }
  }
  return null
}
