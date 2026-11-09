import { ForbiddenException } from '@nestjs/common'
import { DataScopeGuard } from './data-scope.guard'

describe('DataScopeGuard', () => {
  it('all → 放行', async () => {
    const guard = new DataScopeGuard({
      resolve: jest.fn(async () => ({ expr: { op: 'all' }, version: 1, declared: false })),
    } as never)
    await expect(
      guard.assertAllowed({
        organizationId: 'org-1',
        actor: { userId: 'u1' },
        resourceKey: 'platform:orders',
        action: 'read',
      }),
    ).resolves.toBeUndefined()
  })

  it('none → 403', async () => {
    const guard = new DataScopeGuard({
      resolve: jest.fn(async () => ({ expr: { op: 'none' }, version: 1, declared: true })),
    } as never)
    await expect(
      guard.assertAllowed({
        organizationId: 'org-1',
        actor: { userId: 'u1' },
        resourceKey: 'platform:orders',
        action: 'read',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
