import { IdentitySyncService } from './identity-sync.service'
import { IdentitySourceAdapterRegistry } from './identity-source'

const PROVIDER = {
  id: 'p1',
  organizationId: 'org-1',
  key: 'sis',
  type: 'sis',
  status: 'active',
  defaultRoleName: 'student',
}

function setup(options: {
  external?: any[]
  existing?: any[]
  role?: any
  user?: any
  sourceError?: Error
}) {
  const providers = { findOne: jest.fn(async () => PROVIDER) }
  const linkStore = [...(options.existing ?? [])]
  const links = {
    find: jest.fn(async () => linkStore),
    create: jest.fn((row) => ({ id: 'link-new', ...row })),
    save: jest.fn(async (row) => {
      const index = linkStore.findIndex((item) => item.id === row.id)
      if (index >= 0) linkStore[index] = row
      else linkStore.push(row)
      return row
    }),
  }
  const runs = {
    create: jest.fn((row) => ({ id: 'run-1', ...row })),
    save: jest.fn(async (row) => row),
  }
  const adapters = new IdentitySourceAdapterRegistry()
  adapters.register({
    type: 'sis',
    listUsers: jest.fn(async () => {
      if (options.sourceError) throw options.sourceError
      return options.external ?? []
    }),
  })
  const users = {
    findByEmail: jest.fn(async () => options.user ?? null),
    create: jest.fn(async (input) => ({ id: 'user-new', ...input })),
    update: jest.fn(async () => ({})),
  }
  const roles = {
    findByName: jest.fn(async () =>
      options.role === undefined ? { id: 'role-student' } : options.role,
    ),
  }
  const sessions = { revokeAll: jest.fn(async () => 1) }
  const memberRoles = {
    list: jest.fn(async () => [{ roleName: 'student', status: 'active' }]),
    revoke: jest.fn(async () => true),
  }
  return {
    service: new IdentitySyncService(
      providers as never,
      links as never,
      runs as never,
      adapters,
      users as never,
      roles as never,
      sessions as never,
      memberRoles as never,
    ),
    links,
    runs,
    users,
    sessions,
    memberRoles,
  }
}

describe('IdentitySyncService', () => {
  it('新增外部身份 → JIT 建号 + link，统计 created', async () => {
    const { service, links } = setup({
      external: [{ externalId: 'ext-1', email: 'a@example.com', name: 'A', active: true }],
    })
    const result = await service.run('org-1', 'sis')
    expect(result.status).toBe('succeeded')
    expect(result.stats).toMatchObject({ created: 1, updated: 0, deactivated: 0 })
    expect(links.save).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'ext-1', userId: 'user-new' }),
    )
  })

  it('已有 link → 更新属性，不重复建号', async () => {
    const { service, users } = setup({
      external: [{ externalId: 'ext-1', email: 'a@example.com', active: true, attributes: { x: 1 } }],
      existing: [{ id: 'l1', externalId: 'ext-1', userId: 'u1', organizationId: 'org-1' }],
    })
    const result = await service.run('org-1', 'sis')
    expect(result.stats).toMatchObject({ created: 0, updated: 1 })
    expect(users.create).not.toHaveBeenCalled()
  })

  it('外部列表缺失 → 停用用户、吊销会话、回收角色', async () => {
    const { service, users, sessions, memberRoles } = setup({
      external: [],
      existing: [{ id: 'l1', externalId: 'gone', userId: 'u1', organizationId: 'org-1' }],
    })
    const result = await service.run('org-1', 'sis')
    expect(result.stats.deactivated).toBe(1)
    expect(users.update).toHaveBeenCalledWith('u1', { status: 'inactive' })
    expect(sessions.revokeAll).toHaveBeenCalledWith('org-1', 'u1', 'identity-sync')
    expect(memberRoles.revoke).toHaveBeenCalledWith('org-1', 'u1', 'student')
  })

  it('源不可用 → run failed，不做降级删除', async () => {
    const { service, users } = setup({ sourceError: new Error('source down') })
    const result = await service.run('org-1', 'sis')
    expect(result.status).toBe('failed')
    expect(users.update).not.toHaveBeenCalled()
  })

  it('默认角色不存在 → 新增失败计入 failed，run partial', async () => {
    const { service } = setup({
      external: [{ externalId: 'ext-1', email: 'a@example.com', active: true }],
      role: null,
    })
    const result = await service.run('org-1', 'sis')
    expect(result.status).toBe('partial')
    expect(result.stats).toMatchObject({ created: 0, failed: 1 })
  })
})
