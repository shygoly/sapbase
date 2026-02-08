'use client'

import type { MenuItem } from './config'

export interface MenuCacheEntry {
  data: MenuItem[]
  timestamp: number
  ttl: number
}

export class MenuService {
  private cache: Map<string, MenuCacheEntry> = new Map()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

  async loadMenu(
    organizationId: string,
    permissions: string[],
    ttl: number = this.DEFAULT_TTL
  ): Promise<MenuItem[]> {
    const cacheKey = this.getCacheKey(organizationId, permissions)

    // Check cache
    const cached = this.cache.get(cacheKey)
    if (cached && !this.isExpired(cached)) {
      return cached.data
    }

    // Load from API
    const menu = await this.fetchMenuFromAPI(organizationId, permissions)

    // Cache result
    this.cache.set(cacheKey, {
      data: menu,
      timestamp: Date.now(),
      ttl,
    })

    return menu
  }

  private getCacheKey(organizationId: string, permissions: string[]): string {
    return `${organizationId}:${permissions.sort().join(',')}`
  }

  private isExpired(entry: MenuCacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private async fetchMenuFromAPI(
    organizationId: string,
    permissions: string[]
  ): Promise<MenuItem[]> {
    try {
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, permissions }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch menu: ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      console.error('Error fetching menu:', error)
      return []
    }
  }

  clearCache(organizationId?: string): void {
    if (organizationId) {
      // Clear cache for specific organization
      for (const key of this.cache.keys()) {
        if (key.startsWith(organizationId)) {
          this.cache.delete(key)
        }
      }
    } else {
      // Clear all cache
      this.cache.clear()
    }
  }

  filterMenuByPermissions(menu: MenuItem[], permissions: string[]): MenuItem[] {
    return menu
      .filter(item => !item.permissions || item.permissions.some(p => permissions.includes(p)))
      .map(item => ({
        ...item,
        children: item.children ? this.filterMenuByPermissions(item.children, permissions) : undefined,
      }))
      .filter(item => item.children?.length || item.path)
  }
}

export const menuService = new MenuService()
