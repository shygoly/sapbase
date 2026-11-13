import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import type { Observable } from 'rxjs'

export const LEGACY_API_SUNSET = 'Wed, 30 Jun 2027 00:00:00 GMT'
export const LEGACY_API_DOC = '/docs/protocols/api-deprecation.md'

/**
 * tenant-only API 的弃用信号（1.4）。
 *
 * 只在**没有** `X-App-Id` 的兼容调用上添加 header；不改变响应体、
 * 权限、RLS 或确认令牌语义。应用上下文入口不会收到弃用提示。
 */
@Injectable()
export class LegacyTenantApiDeprecationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest()
    const response = context.switchToHttp().getResponse()
    const appId = request?.headers?.['x-app-id']
    if (appId === undefined || appId === null || String(appId).trim() === '') {
      response?.setHeader?.('Deprecation', 'true')
      response?.setHeader?.('Sunset', LEGACY_API_SUNSET)
      response?.setHeader?.('Link', `<${LEGACY_API_DOC}>; rel="deprecation"`)
      response?.setHeader?.(
        'Warning',
        '299 - "tenant-only API; send X-App-Id to opt in to app-scoped semantics"',
      )
    }
    return next.handle()
  }
}
