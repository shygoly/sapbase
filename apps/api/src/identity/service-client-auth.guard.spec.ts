import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { ServiceClientAuthGuard } from './service-client-auth.guard'

function context(request: Record<string, any>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as never
}

function guardWith(client: any, required: string[] = []) {
  const clients = { authenticate: jest.fn(async () => client) }
  const reflector = { getAllAndOverride: jest.fn(() => required) }
  return {
    guard: new ServiceClientAuthGuard(clients as never, reflector as never),
    clients,
  }
}

const CLIENT = {
  id: 'c1',
  organizationId: 'org-1',
  key: 'sis-sync',
  scopes: ['student:read'],
  ipAllowlist: null,
  appInstallationId: null,
}

describe('ServiceClientAuthGuard', () => {
  it('缺少头 → 401', async () => {
    const { guard } = guardWith(CLIENT)
    await expect(guard.canActivate(context({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('认证失败 → 401', async () => {
    const { guard } = guardWith(null)
    await expect(
      guard.canActivate(
        context({
          headers: {
            'x-organization-id': 'org-1',
            'x-service-key': 'sis-sync',
            'x-service-secret': 'bad',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('scope 不足 → 403', async () => {
    const { guard } = guardWith(CLIENT, ['student:read', 'student:write'])
    await expect(
      guard.canActivate(
        context({
          headers: {
            'x-organization-id': 'org-1',
            'x-service-key': 'sis-sync',
            'x-service-secret': 'ok',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('IP 不在白名单 → 403', async () => {
    const { guard } = guardWith({ ...CLIENT, ipAllowlist: ['10.0.0.1'] })
    await expect(
      guard.canActivate(
        context({
          headers: {
            'x-organization-id': 'org-1',
            'x-service-key': 'sis-sync',
            'x-service-secret': 'ok',
          },
          ip: '10.0.0.2',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('app installation 绑定不一致 → 403', async () => {
    const { guard } = guardWith({
      ...CLIENT,
      appInstallationId: '11111111-1111-4111-8111-111111111111',
    })
    await expect(
      guard.canActivate(
        context({
          headers: {
            'x-organization-id': 'org-1',
            'x-service-key': 'sis-sync',
            'x-service-secret': 'ok',
            'x-app-installation-id': '22222222-2222-4222-8222-222222222222',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('通过：注入 serviceClient 与 organizationId，不注入用户权限', async () => {
    const { guard, clients } = guardWith(CLIENT, ['student:read'])
    const request: Record<string, any> = {
      headers: {
        'x-organization-id': 'org-1',
        'x-service-key': 'sis-sync',
        'x-service-secret': 'ok',
      },
      ip: '127.0.0.1',
    }
    await expect(guard.canActivate(context(request))).resolves.toBe(true)
    expect(clients.authenticate).toHaveBeenCalledWith('org-1', 'sis-sync', 'ok')
    expect(request.serviceClient).toMatchObject({ key: 'sis-sync' })
    expect(request.organizationId).toBe('org-1')
    expect(request.user).toBeUndefined()
  })
})
