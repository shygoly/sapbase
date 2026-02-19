import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { Reflector } from '@nestjs/core'

export const CACHE_EVICT_METADATA = 'cache:evict'

/**
 * Evict cache after method execution
 */
export const CacheEvict = (key: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(CACHE_EVICT_METADATA, key, descriptor.value)
    return descriptor
  }
}

@Injectable()
export class CacheEvictInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest()
    const cacheKey = this.reflector.get<string>(CACHE_EVICT_METADATA, context.getHandler())

    return next.handle().pipe(
      tap(async () => {
        if (cacheKey) {
          const resolvedKey = this.resolveCacheKey(cacheKey, request)
          await this.cacheManager.del(resolvedKey)
        }
      }),
    )
  }

  private resolveCacheKey(key: string, request: any): string {
    let resolvedKey = key

    // Replace :paramName with actual values
    const paramMatches = key.match(/:(\w+)/g)
    if (paramMatches) {
      paramMatches.forEach((match) => {
        const paramName = match.substring(1)
        const value = request.params[paramName] || request.query[paramName] || request.body?.[paramName]
        if (value !== undefined) {
          resolvedKey = resolvedKey.replace(match, String(value))
        }
      })
    }

    // Add organization context
    if (request.organizationId) {
      resolvedKey = `org:${request.organizationId}:${resolvedKey}`
    }

    return resolvedKey
  }
}
