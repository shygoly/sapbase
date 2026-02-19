import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common'
import { Observable, of } from 'rxjs'
import { tap } from 'rxjs/operators'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { Reflector } from '@nestjs/core'
import { CACHE_KEY_METADATA, CACHE_TTL_METADATA } from '../decorators/cache.decorator'

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest()
    const cacheKey = this.reflector.get<string>(CACHE_KEY_METADATA, context.getHandler())
    const cacheTtl = this.reflector.get<number>(CACHE_TTL_METADATA, context.getHandler()) || 300

    if (!cacheKey) {
      return next.handle()
    }

    // Replace dynamic parameters in cache key
    const resolvedKey = this.resolveCacheKey(cacheKey, request)

    // Try to get from cache
    const cachedValue = await this.cacheManager.get(resolvedKey)
    if (cachedValue) {
      return of(cachedValue)
    }

    // If not cached, execute handler and cache result
    return next.handle().pipe(
      tap(async (response) => {
        // Only cache successful responses (status 200-299)
        if (response && (!response.statusCode || (response.statusCode >= 200 && response.statusCode < 300))) {
          const dataToCache = response.data || response
          await this.cacheManager.set(resolvedKey, dataToCache, cacheTtl)
        }
      }),
    )
  }

  private resolveCacheKey(key: string, request: any): string {
    let resolvedKey = key

    // Replace :paramName with actual values from request
    const paramMatches = key.match(/:(\w+)/g)
    if (paramMatches) {
      paramMatches.forEach((match) => {
        const paramName = match.substring(1) // Remove ':'
        const value = request.params[paramName] || request.query[paramName] || request.body?.[paramName]
        if (value !== undefined) {
          resolvedKey = resolvedKey.replace(match, String(value))
        }
      })
    }

    // Add organization context if available
    if (request.organizationId) {
      resolvedKey = `org:${request.organizationId}:${resolvedKey}`
    }

    return resolvedKey
  }
}
