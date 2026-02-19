import { cache } from '../utils/cache';

/**
 * Enhanced API client with built-in caching.
 * 
 * Usage:
 * ```ts
 * const api = createCachedApi();
 * 
 * // This will cache the result for 5 minutes
 * const user = await api.get('/api/users/123');
 * 
 * // Clear cache for a specific endpoint
 * api.clearCache('/api/users/123');
 * ```
 */

interface ApiOptions {
  baseUrl?: string;
  defaultCacheTTL?: number;
  headers?: Record<string, string>;
}

const TOKEN_KEY = 'access_token'

class CachedApiClient {
  private baseUrl: string;
  private defaultCacheTTL: number;
  private headers: Record<string, string>;

  constructor(options: ApiOptions = {}) {
    this.baseUrl = options.baseUrl || '';
    this.defaultCacheTTL = options.defaultCacheTTL || 5 * 60 * 1000; // 5 minutes
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  /** Auth headers from localStorage (same keys as httpClient) so cached requests are authorized. */
  private getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {}
    const token = localStorage.getItem(TOKEN_KEY)
    const organizationId = localStorage.getItem('currentOrganizationId')
    const h: Record<string, string> = {}
    if (token) h.Authorization = `Bearer ${token}`
    if (organizationId) h['X-Organization-Id'] = organizationId
    return h
  }

  private getCacheKey(method: string, url: string, body?: any): string {
    const bodyHash = body ? JSON.stringify(body) : '';
    return `api:${method}:${url}:${bodyHash}`;
  }

  async get<T>(url: string, options?: { cacheTTL?: number }): Promise<T> {
    const cacheKey = this.getCacheKey('GET', url);
    const cached = cache.get<T>(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'GET',
      headers: { ...this.headers, ...this.getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    cache.set(cacheKey, data, options?.cacheTTL || this.defaultCacheTTL);
    return data;
  }

  async post<T>(
    url: string,
    body: any,
    options?: { cacheTTL?: number; skipCache?: boolean }
  ): Promise<T> {
    const cacheKey = this.getCacheKey('POST', url, body);
    
    if (!options?.skipCache) {
      const cached = cache.get<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'POST',
      headers: { ...this.headers, ...this.getAuthHeaders() },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!options?.skipCache) {
      cache.set(cacheKey, data, options?.cacheTTL || this.defaultCacheTTL);
    }
    
    return data;
  }

  async put<T>(url: string, body: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'PUT',
      headers: { ...this.headers, ...this.getAuthHeaders() },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate related cache entries
    this.clearCache(url);
    
    return data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: 'DELETE',
      headers: { ...this.headers, ...this.getAuthHeaders() },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Invalidate related cache entries
    this.clearCache(url);
    
    return data;
  }

  /**
   * Clear cache for a specific URL pattern.
   */
  clearCache(urlPattern?: string): void {
    if (urlPattern) {
      // Clear specific cache entries matching the pattern
      const keys = Array.from(cache['store'].keys());
      keys.forEach((key) => {
        if (key.includes(urlPattern)) {
          cache.delete(key);
        }
      });
    } else {
      // Clear all API cache
      const keys = Array.from(cache['store'].keys());
      keys.forEach((key) => {
        if (key.startsWith('api:')) {
          cache.delete(key);
        }
      });
    }
  }

  /**
   * Prefetch a URL and cache it.
   */
  async prefetch<T>(url: string, cacheTTL?: number): Promise<void> {
    try {
      await this.get<T>(url, { cacheTTL });
    } catch (error) {
      // Silently fail for prefetch
    }
  }
}

export function createCachedApi(options?: ApiOptions) {
  return new CachedApiClient(options);
}

// Default instance
export const cachedApi = createCachedApi();
