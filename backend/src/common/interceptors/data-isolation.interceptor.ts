import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common'
import { Observable } from 'rxjs'

/**
 * Retired compatibility shim.
 *
 * The old interceptor forwarded `organizationId` unchanged and did not filter
 * anything. Keeping it wired would create a false sense of isolation. Tenant
 * requests now run through TenantTransactionInterceptor + PostgreSQL RLS.
 */
@Injectable()
export class DataIsolationInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, _next: CallHandler): Observable<unknown> {
    throw new InternalServerErrorException(
      'DataIsolationInterceptor 已退场；请使用 TenantTransactionInterceptor 与数据库 RLS',
    )
  }
}
