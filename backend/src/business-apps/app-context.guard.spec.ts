import { BadRequestException } from '@nestjs/common'
import { AppContextGuard } from './app-context.guard'

function context(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never
}

describe('AppContextGuard', () => {
  const resolved = {
    organizationId: 'org-1',
    appInstallationId: 'app-1',
    appKey: 'erp',
    userId: 'user-1',
    grantedPermissions: ['tool:module:read'],
    runtimeProfile: 'shared-saas' as const,
    traceId: 'trace-1',
  }

  it('只从 JWT 用户与 X-App-Id 解析上下文，忽略 body 中的身份声明', async () => {
    const apps = {
      resolveExecutionContext: jest.fn(async () => resolved),
    }
    const guard = new AppContextGuard(apps as never, { currentRelease: jest.fn(async () => null) } as never)
    const request: Record<string, any> = {
      user: {
        id: 'user-1',
        organizationId: 'org-1',
        permissions: ['tool:module:read'],
      },
      headers: { 'x-app-id': 'app-1' },
      body: {
        organizationId: 'org-attacker',
        userId: 'user-attacker',
        permissions: ['tool:god'],
      },
    }

    await expect(guard.canActivate(context(request))).resolves.toBe(true)
    expect(apps.resolveExecutionContext).toHaveBeenCalledWith({
      installationId: 'app-1',
      organizationId: 'org-1',
      userId: 'user-1',
      grantedPermissions: ['tool:module:read'],
    })
    expect(request.appContext).toEqual(resolved)
  })

  it('缺少组织上下文时拒绝', async () => {
    const guard = new AppContextGuard({} as never, {} as never)
    await expect(
      guard.canActivate(
        context({
          user: { id: 'user-1' },
          headers: { 'x-app-id': 'app-1' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('缺少 X-App-Id 时拒绝', async () => {
    const guard = new AppContextGuard({} as never, {} as never)
    await expect(
      guard.canActivate(
        context({
          user: { id: 'user-1', organizationId: 'org-1' },
          headers: {},
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('路径应用 id 与 X-App-Id 不一致时拒绝', async () => {
    const guard = new AppContextGuard({} as never, {} as never)
    await expect(
      guard.canActivate(
        context({
          user: { id: 'user-1', organizationId: 'org-1' },
          headers: { 'x-app-id': 'app-other' },
          params: { id: 'app-1' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
