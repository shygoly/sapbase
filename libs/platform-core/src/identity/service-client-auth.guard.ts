import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ServiceClientsService } from './service-clients.service'

export const SERVICE_SCOPES_KEY = 'service_scopes'

/** 声明服务令牌必须具备的 scope（all-of）。 */
export const ServiceScopes = (...scopes: string[]) => SetMetadata(SERVICE_SCOPES_KEY, scopes)

/**
 * 服务令牌守卫：
 *   - `X-Organization-Id` + `X-Service-Key` + `X-Service-Secret`
 *   - 组织绑定、过期/吊销、scope all-of、可选 app installation 绑定、IP allowlist
 *
 * 通过后只把 serviceClient 与 organizationId 放进 request；**不**注入用户权限。
 * 代用户调用必须由业务用例重新解析权限/数据范围（INV-ID-04）。
 */
@Injectable()
export class ServiceClientAuthGuard implements CanActivate {
  constructor(
    private readonly clients: ServiceClientsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const organizationId =
      header(request, 'x-organization-id') ?? request.organizationId
    const key = header(request, 'x-service-key')
    const secret = header(request, 'x-service-secret')
    if (!organizationId || !key || !secret) {
      throw new UnauthorizedException('缺少服务令牌头（组织/key/secret）')
    }
    const client = await this.clients.authenticate(organizationId, key, secret)
    if (!client) {
      throw new UnauthorizedException('服务令牌无效、已过期或已停用')
    }
    const required =
      this.reflector.getAllAndOverride<string[]>(SERVICE_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    if (required.length > 0) {
      const granted = new Set(client.scopes ?? [])
      if (!granted.has('*') && !required.every((scope) => granted.has(scope))) {
        throw new ForbiddenException(
          `服务令牌缺少 scope：${required.filter((scope) => !granted.has(scope)).join(', ')}`,
        )
      }
    }
    if (client.ipAllowlist && client.ipAllowlist.length > 0) {
      if (!matchesAllowlist(request.ip ?? request.socket?.remoteAddress, client.ipAllowlist)) {
        throw new ForbiddenException('服务令牌来源 IP 不在白名单')
      }
    }
    if (client.appInstallationId) {
      const appId = header(request, 'x-app-installation-id')
      if (appId !== client.appInstallationId) {
        throw new ForbiddenException('服务令牌与 app installation 绑定不一致')
      }
    }
    request.serviceClient = client
    request.organizationId = organizationId
    return true
  }
}

function header(request: Record<string, any>, name: string): string | undefined {
  const value = request.headers?.[name]
  return Array.isArray(value) ? value[0] : value
}

function matchesAllowlist(ip: string | undefined, allowlist: string[]): boolean {
  if (!ip) return false
  return allowlist.some((entry) => {
    if (entry === '*') return true
    if (entry.endsWith('*')) return ip.startsWith(entry.slice(0, -1))
    return ip === entry
  })
}
