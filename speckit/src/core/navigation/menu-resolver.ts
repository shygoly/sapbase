import type { MenuItem, MenuResolverOptions } from './types'

export class MenuResolver {
  private menuCache: Map<string, MenuItem[]> = new Map()

  async resolveMenu(options: MenuResolverOptions): Promise<MenuItem[]> {
    const cacheKey = `${options.organizationId}:${options.permissions.join(',')}`

    if (this.menuCache.has(cacheKey)) {
      return this.menuCache.get(cacheKey)!
    }

    // Filter menu items based on permissions
    const menu = await this.loadMenuItems(options.organizationId)
    const filtered = this.filterByPermissions(menu, options.permissions)

    this.menuCache.set(cacheKey, filtered)
    return filtered
  }

  private async loadMenuItems(_organizationId: string): Promise<MenuItem[]> {
    // TODO: Load from API or schema
    return []
  }

  private filterByPermissions(menu: MenuItem[], permissions: string[]): MenuItem[] {
    return menu
      .filter(item => !item.permission || permissions.includes(item.permission))
      .map(item => ({
        ...item,
        children: item.children ? this.filterByPermissions(item.children, permissions) : undefined
      }))
      .filter(item => item.visible && (item.children?.length || item.path))
  }

  clearCache(): void {
    this.menuCache.clear()
  }
}
