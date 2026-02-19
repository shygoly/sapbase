import { Injectable, Inject } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key)
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl)
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key)
  }

  /**
   * Clear all cache (Note: cache-manager doesn't support reset, use del for specific keys)
   */
  async reset(): Promise<void> {
    // Note: cache-manager doesn't provide a reset method
    // For clearing all cache, you would need direct Redis access
    // This is a placeholder for future implementation
    throw new Error('Reset not supported. Use del() for specific keys.')
  }

  /**
   * Generate cache key with prefix
   */
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`
  }

  /**
   * Generate organization-scoped cache key
   */
  orgKey(organizationId: string, prefix: string, ...parts: (string | number)[]): string {
    return this.generateKey(`org:${organizationId}`, prefix, ...parts)
  }

  /**
   * Invalidate all cache keys matching pattern (requires Redis)
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // Note: This requires direct Redis access, which cache-manager doesn't provide
    // For pattern invalidation, you may need to use redis client directly
    // This is a placeholder for future implementation
  }
}
