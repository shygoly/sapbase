import { UnifiedMenuItem } from '@/types/navigation'

interface BackendMenuItem {
  id: string
  label: string
  path?: string
  icon?: string
  permissions?: string[]
  visible: boolean
  disabled?: boolean
  order: number
  children?: BackendMenuItem[]
}

export function adaptBackendMenuToUnified(
  items: BackendMenuItem[],
  userPermissions: string[] = [],
): UnifiedMenuItem[] {
  return items
    .filter((item) => {
      if (item.visible === false) return false // Only filter if explicitly false
      if (item.disabled === true) return false // Filter disabled items
      if (!item.permissions || item.permissions.length === 0) return true
      // Check if user has any of the required permissions
      const hasPermission = item.permissions.some((p) => userPermissions.includes(p))
      if (!hasPermission && item.label.includes('AI')) {
        console.log(`Filtered out menu item: ${item.label}, required permissions:`, item.permissions, 'user has:', userPermissions.filter(p => item.permissions?.includes(p)))
      }
      return hasPermission
    })
    .map((item) => {
      // Recursively filter children
      const filteredChildren = item.children
        ? adaptBackendMenuToUnified(item.children, userPermissions)
        : undefined
      
      return {
        id: item.id,
        label: item.label,
        path: item.path,
        icon: item.icon,
        permissions: item.permissions,
        visible: item.visible,
        disabled: item.disabled,
        order: item.order,
        children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : undefined,
      }
    })
    // Keep parent items even if they have no children (they might be expandable or have a path)
    .filter((item) => {
      // Keep if has children OR has no permission requirements OR has a path (can be clicked)
      return (item.children && item.children.length > 0) || !item.permissions || item.permissions.length === 0 || item.path
    })
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
