import { ForbiddenException } from '@nestjs/common'
import { TenantContextMiddleware } from './tenant-context.middleware'

function request(overrides: Record<string, unknown> = {}) {
  return {
    headers: { authorization: 'Bearer token' },
    query: {},
    path: '/roles',
    originalUrl: '/api/roles',
    ...overrides,
  } as any
}

describe('TenantContextMiddleware', () => {
  it('租户头与 JWT 当前组织一致且存在成员关系时放行', async () => {
    const memberRepository = {
      findOne: jest.fn(async () => ({ organizationId: 'org-1', organization: { id: 'org-1' } })),
    }
    const jwtService = {
      decode: jest.fn(() => ({ sub: 'user-1', organizationId: 'org-1' })),
    }
    const middleware = new TenantContextMiddleware(memberRepository as never, jwtService as never)
    const req = request({ headers: { authorization: 'Bearer token', 'x-organization-id': 'org-1' } })
    const next = jest.fn()

    await middleware.use(req, {} as never, next)
    expect(memberRepository.findOne).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'user-1' },
      relations: ['organization'],
    })
    expect(req.organizationId).toBe('org-1')
    expect(next).toHaveBeenCalled()
  })

  it('X-Organization-Id 与 JWT 当前组织不同时拒绝', async () => {
    const middleware = new TenantContextMiddleware(
      { findOne: jest.fn() } as never,
      { decode: jest.fn(() => ({ sub: 'user-1', organizationId: 'org-1' })) } as never,
    )
    await expect(
      middleware.use(
        request({ headers: { authorization: 'Bearer token', 'x-organization-id': 'org-2' } }),
        {} as never,
        jest.fn(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('用户不属于请求组织时拒绝', async () => {
    const middleware = new TenantContextMiddleware(
      { findOne: jest.fn(async () => null) } as never,
      { decode: jest.fn(() => ({ sub: 'user-1', organizationId: 'org-1' })) } as never,
    )
    await expect(
      middleware.use(
        request({ headers: { authorization: 'Bearer token', 'x-organization-id': 'org-1' } }),
        {} as never,
        jest.fn(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
