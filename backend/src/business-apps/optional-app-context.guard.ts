import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { BusinessAppsService } from './business-apps.service'

/**
 * Legacy-compatible app context resolution.
 *
 * Missing X-App-Id keeps old tenant-only behavior during migration. Once the
 * header is present, it is validated exactly like the mandatory guard.
 */
@Injectable()
export class OptionalAppContextGuard implements CanActivate {
  constructor(private readonly apps: BusinessAppsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const installationId = request.headers?.['x-app-id']
    if (installationId === undefined) return true
    if (typeof installationId !== 'string' || installationId.trim().length === 0) {
      throw new BadRequestException('X-App-Id 不能为空')
    }

    const user = request.user as
      | { id?: string; userId?: string; organizationId?: string; permissions?: string[] }
      | undefined
    if (!user?.organizationId) {
      throw new BadRequestException('缺少组织上下文（organizationId）')
    }
    const userId = user.id ?? user.userId
    if (!userId) throw new BadRequestException('缺少用户身份')

    request.appContext = await this.apps.resolveExecutionContext({
      installationId: installationId.trim(),
      organizationId: user.organizationId,
      userId,
      grantedPermissions: user.permissions ?? [],
    })
    return true
  }
}
