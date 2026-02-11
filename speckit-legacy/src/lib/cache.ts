export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  key: string
}

export class Cache {
  private static instance: Cache
  private store: Map<string, { value: any; expiresAt?: number }> = new Map()

  private constructor() {}

  static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache()
    }
    return Cache.instance
  }

  set(key: string, value: any, ttl?: number): void {
    const expiresAt = ttl ? Date.now() + ttl : undefined
    this.store.set(key, { value, expiresAt })
  }

  get(key: string): any {
    const item = this.store.get(key)
    if (!item) return null

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key)
      return null
    }

    return item.value
  }

  has(key: string): boolean {
    const item = this.store.get(key)
    if (!item) return false

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key)
      return false
    }

    return true
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}

export const cache = Cache.getInstance()
