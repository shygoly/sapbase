import { NotFoundException } from '@nestjs/common'
import { DelegatedIdentityService } from './delegated-identity.service'

function serviceWith(overrides: {
  org?: () => Promise<unknown>
  user?: any
  roles?: string[]
  permissions?: string[]
} = {}) {
  const users = {
    findOne: jest.fn(async () => overrides.user ?? {
      id: 'u1',
      role: 'teacher',
      permissions: ['direct:read'],
    }),
  }
  const organizations = {
    findOne: jest.fn(overrides.org ?? (async () => ({ id: 'org-1' }))),
  }
  const effective = {
    resolve: jest.fn(async () => overrides.permissions ?? ['student:read', 'direct:read']),
  }
  const memberRoles = {
    activeRoleNames: jest.fn(async () => overrides.roles ?? ['head_teacher']),
  }
  return {
    service: new DelegatedIdentityService(
      users as never,
      organizations as never,
      effective as never,
      memberRoles as never,
    ),
    effective,
  }
}

describe('DelegatedIdentityService', () => {
  it('服务端解析角色并集与权限，不使用调用方声明', async () => {
    const { service, effective } = serviceWith()
    const result = await service.resolve('org-1', 'u1')
    expect(result).toMatchObject({
      userId: 'u1',
      role: 'teacher',
      roles: ['teacher', 'head_teacher'],
      permissions: ['student:read', 'direct:read'],
    })
    expect(effective.resolve).toHaveBeenCalledWith({
      role: 'teacher',
      additionalRoles: ['head_teacher'],
      directPermissions: ['direct:read'],
      organizationId: 'org-1',
    })
  })

  it('非本组织成员 → 404（不泄露）', async () => {
    const { service } = serviceWith({
      org: async () => {
        throw new NotFoundException('Organization not found or access denied')
      },
    })
    await expect(service.resolve('org-2', 'u1')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('无 primary role 时使用第一个 active 角色', async () => {
    const { service } = serviceWith({
      user: { id: 'u1', permissions: [] },
      roles: ['student'],
    })
    await expect(service.resolve('org-1', 'u1')).resolves.toMatchObject({ role: 'student' })
  })
})
