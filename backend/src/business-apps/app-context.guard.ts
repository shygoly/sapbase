import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common'
import { BusinessAppsService } from './business-apps.service'

@Injectable()
export class AppContextGuard implements CanActivate {
  constructor(private readonly apps: BusinessAppsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user as
      | {
          id?: string
          userId?: string
          organizationId?: string
          permissions?: string[]
        }
      | undefined

    if (!user?.organizationId) {
      throw new BadRequestException('缺少组织上下文（organizationId）')
    }

    const installationId = request.headers?.['x-app-id']
    if (typeof installationId !== 'string' || installationId.trim().length === 0) {
      throw new BadRequestException('缺少应用上下文（X-App-Id）')
    }
    const routeInstallationId = request.params?.id
    if (
      typeof routeInstallationId === 'string' &&
      routeInstallationId.length > 0 &&
      routeInstallationId !== installationId.trim()
    ) {
      throw new BadRequestException('路径中的应用 id 与 X-App-Id 不一致')
    }

    const userId = user.id ?? user.userId
    if (!userId) {
      throw new BadRequestException('缺少用户身份')
    }

    request.appContext = await this.apps.resolveExecutionContext({
      installationId: installationId.trim(),
      organizationId: user.organizationId,
      userId,
      grantedPermissions: user.permissions ?? [],
    })
    return true
  }
}
