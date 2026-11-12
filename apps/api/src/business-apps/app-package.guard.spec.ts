import { ForbiddenException } from '@nestjs/common'
import { AppPackageGuard } from './app-package.guard'

function context(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never
}

const installation = {
  id: 'app-crm',
  appKey: 'crm',
  blueprintId: 'crm',
  blueprintVersion: '1.0.0',
  status: 'active',
}

function setup() {
  const dataSource = {
    query: jest.fn(async () => [installation]),
  }
  return { guard: new AppPackageGuard(dataSource as never), dataSource }
}

const USER = { user: { id: 'u1', organizationId: 'org-1' } }

describe('AppPackageGuard', () => {
  it('没有 X-App-Id：保持旧租户调用兼容', async () => {
    const { guard, dataSource } = setup()
    await expect(
      guard.canActivate(context({ ...USER, params: { id: 'erp-1.0.0' }, headers: {} })),
    ).resolves.toBe(true)
    expect(dataSource.query).not.toHaveBeenCalled()
  })

  it('package 属于当前 installation：放行', async () => {
    const { guard } = setup()
    await expect(
      guard.canActivate(
        context({
          ...USER,
          params: { id: 'crm-1.0.0' },
          headers: { 'x-app-id': 'app-crm' },
        }),
      ),
    ).resolves.toBe(true)
    await expect(
      guard.canActivate(
        context({
          ...USER,
          params: { id: 'crm' },
          headers: { 'x-app-id': 'app-crm' },
        }),
      ),
    ).resolves.toBe(true)
  })

  it('CRM 访问 ERP package：403', async () => {
    const { guard } = setup()
    await expect(
      guard.canActivate(
        context({
          ...USER,
          params: { id: 'erp-1.0.0' },
          headers: { 'x-app-id': 'app-crm' },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('缺少可信组织/用户：403', async () => {
    const { guard } = setup()
    await expect(
      guard.canActivate(
        context({
          params: { id: 'crm-1.0.0' },
          headers: { 'x-app-id': 'app-crm' },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
