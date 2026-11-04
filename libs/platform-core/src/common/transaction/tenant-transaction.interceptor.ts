import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { from, lastValueFrom, Observable } from 'rxjs'
import { DataSource } from 'typeorm'
import { withTenantContext } from './with-tenant-context'

@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()

    const request = context.switchToHttp().getRequest()
    const user = request.user as
      | { id?: string; userId?: string; organizationId?: string }
      | undefined
    const organizationId =
      (request.organizationId as string | undefined) ??
      user?.organizationId ??
      ''
    const userId = user?.id ?? user?.userId ?? ''
    const appInstallationId =
      (request.appContext as { appInstallationId?: string } | undefined)
        ?.appInstallationId ?? ''

    // Public requests have no tenant identity. They stay outside the tenant
    // transaction; any tenant table is still denied for a non-owner DB role.
    if (!organizationId && !userId) return next.handle()

    return from(
      withTenantContext(
        this.dataSource,
        { organizationId, appInstallationId, userId },
        () => lastValueFrom(next.handle(), { defaultValue: undefined }),
      ),
    )
  }
}
