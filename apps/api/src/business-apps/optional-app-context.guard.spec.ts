import { BadRequestException } from '@nestjs/common'
import { OptionalAppContextGuard } from './optional-app-context.guard'

function context(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never
}

describe('OptionalAppContextGuard', () => {
  it('没有 X-App-Id 时保留旧租户路径', async () => {
    const apps = { resolveExecutionContext: jest.fn() }
    const guard = new OptionalAppContextGuard(apps as never)
    const request = { user: { id: 'user-1', organizationId: 'org-1' }, headers: {} }
    await expect(guard.canActivate(context(request))).resolves.toBe(true)
    expect(apps.resolveExecutionContext).not.toHaveBeenCalled()
    expect(request).not.toHaveProperty('appContext')
  })

  it('有 X-App-Id 时解析可信上下文', async () => {
    const appContext = {
      organizationId: 'org-1',
      appInstallationId: 'app-1',
      appKey: 'erp',
      userId: 'user-1',
      grantedPermissions: [],
      runtimeProfile: 'shared-saas',
      traceId: 'trace-1',
    }
    const apps = { resolveExecutionContext: jest.fn(async () => appContext) }
    const guard = new OptionalAppContextGuard(apps as never)
    const request: Record<string, any> = {
      user: { id: 'user-1', organizationId: 'org-1', permissions: [] },
      headers: { 'x-app-id': 'app-1' },
    }
    await expect(guard.canActivate(context(request))).resolves.toBe(true)
    expect(request.appContext).toEqual(appContext)
  })

  it('空 X-App-Id 拒绝，不回退到无应用模式', async () => {
    const guard = new OptionalAppContextGuard({} as never)
    await expect(
      guard.canActivate(
        context({
          user: { id: 'user-1', organizationId: 'org-1' },
          headers: { 'x-app-id': '' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
