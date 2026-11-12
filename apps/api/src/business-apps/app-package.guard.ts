import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { DataSource } from 'typeorm'

/**
 * 包级路径与 X-App-Id 一致性守卫（可选）。
 *
 * 有 X-App-Id 时，`/api/blueprints/:id/...` 的 id 必须属于该 active installation
 * （`blueprintId` 或 `blueprintId-version`）；否则拒绝，避免消费方借另一个应用
 * 的 package id 直接读取私有记录。没有 X-App-Id 的旧租户调用保持兼容。
 *
 * 直接读 `app_installations` 而不是注入 BusinessAppsService，避免
 * SemanticRuntime ↔ BusinessApps 的模块环。
 */
@Injectable()
export class AppPackageGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const installationId = request?.headers?.['x-app-id']
    if (installationId === undefined) return true
    if (typeof installationId !== 'string' || installationId.trim().length === 0) {
      throw new ForbiddenException('X-App-Id 不能为空')
    }
    const packageId = request?.params?.id
    if (!packageId) return true
    const organizationId =
      request?.user?.organizationId ?? request?.organizationId
    const userId =
      request?.user?.id ?? request?.user?.userId ?? request?.user?.sub
    if (!organizationId || !userId) {
      throw new ForbiddenException('缺少可信组织/用户上下文')
    }
    const rows = (await this.dataSource.query(
      `SELECT id, "appKey", "blueprintId", "blueprintVersion"
         FROM public.app_installations
        WHERE id = $1 AND "organizationId" = $2 AND status = 'active'
        LIMIT 1`,
      [installationId, organizationId],
    )) as Array<{
      id: string
      appKey: string
      blueprintId: string
      blueprintVersion: string
    }>
    const installation = rows[0]
    if (!installation) {
      throw new ForbiddenException('应用安装不存在、已停用或不属于当前组织')
    }
    const allowed = new Set([
      installation.blueprintId,
      `${installation.blueprintId}-${installation.blueprintVersion}`,
    ])
    if (!allowed.has(packageId)) {
      throw new ForbiddenException(
        `应用 ${installation.appKey} 不能访问 package ${packageId}`,
      )
    }
    return true
  }
}
