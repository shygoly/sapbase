import { create } from 'zustand'

export interface PermissionCacheEntry {
  permission: string
  allowed: boolean
  timestamp: number
  ttl: number // milliseconds
}

export interface PermissionStoreState {
  cache: Map<string, PermissionCacheEntry>

  // Actions
  checkPermission: (permission: string) => boolean | null
  setPermission: (permission: string, allowed: boolean, ttl?: number) => void
  setPermissions: (permissions: Record<string, boolean>, ttl?: number) => void
  clearCache: () => void
  clearExpiredCache: () => void
  isExpired: (entry: PermissionCacheEntry) => boolean
}

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

export const usePermissionStore = create<PermissionStoreState>((set, get) => ({
  cache: new Map(),

  checkPermission: (permission) => {
    const state = get()
    const entry = state.cache.get(permission)

    if (!entry) return null

    if (state.isExpired(entry)) {
      state.clearCache()
      return null
    }

    return entry.allowed
  },

  setPermission: (permission, allowed, ttl = DEFAULT_TTL) =>
    set((state) => {
      const newCache = new Map(state.cache)
      newCache.set(permission, {
        permission,
        allowed,
        timestamp: Date.now(),
        ttl,
      })
      return { cache: newCache }
    }),

  setPermissions: (permissions, ttl = DEFAULT_TTL) =>
    set((state) => {
      const newCache = new Map(state.cache)
      Object.entries(permissions).forEach(([permission, allowed]) => {
        newCache.set(permission, {
          permission,
          allowed,
          timestamp: Date.now(),
          ttl,
        })
      })
      return { cache: newCache }
    }),

  clearCache: () =>
    set({
      cache: new Map(),
    }),

  clearExpiredCache: () =>
    set((state) => {
      const newCache = new Map(state.cache)
      Array.from(newCache.entries()).forEach(([key, entry]) => {
        if (state.isExpired(entry)) {
          newCache.delete(key)
        }
      })
      return { cache: newCache }
    }),

  isExpired: (entry) => {
    return Date.now() - entry.timestamp > entry.ttl
  },
}))
