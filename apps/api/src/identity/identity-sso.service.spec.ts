import { IdentitySsoService } from './identity-sso.service'

function setup(options: {
  provider?: any
  existingLink?: any
  existingUser?: any
  role?: any
  identity?: any
}) {
  const providers = { findOne: jest.fn(async () => options.provider ?? null) }
  const links = {
    findOne: jest.fn(async () => options.existingLink ?? null),
    create: jest.fn((row) => ({ id: 'link-id', ...row })),
    save: jest.fn(async (row) => row),
  }
  const users = {
    findOne: jest.fn(async () => options.existingUser),
    findByEmail: jest.fn(async () => options.existingUser ?? null),
    create: jest.fn(async (input) => ({ id: 'new-user', ...input })),
  }
  const roles = { findByName: jest.fn(async () => options.role ?? null) }
  const adapter = {
    type: 'cas' as const,
    authorizationUrl: () => '',
    authenticate: jest.fn(async () => options.identity ?? { externalId: 'ext-1', attributes: {} }),
  }
  return {
    service: new IdentitySsoService(
      providers as never,
      links as never,
      users as never,
      roles as never,
      () => adapter,
    ),
    providers,
    links,
    users,
    roles,
    adapter,
  }
}

const PROVIDER = {
  id: 'p1',
  organizationId: 'org-1',
  key: 'cas',
  type: 'cas',
  status: 'active',
  defaultRoleName: 'student',
  config: {},
}

describe('IdentitySsoService', () => {
  it('已有 identity link → 直接返回用户，不 JIT', async () => {
    const { service, users } = setup({
      provider: PROVIDER,
      existingLink: { id: 'l1', userId: 'u1', organizationId: 'org-1' },
      existingUser: { id: 'u1', email: 'a@example.com', name: 'A' },
      identity: { externalId: 'ext-1', attributes: {} },
    })
    const result = await service.authenticate('org-1', 'cas', { ticket: 't' })
    expect(result).toMatchObject({ created: false, user: { id: 'u1' } })
    expect(users.create).not.toHaveBeenCalled()
  })

  it('无 link 但 email 命中已有用户 → 建 link，不建号', async () => {
    const { service, users } = setup({
      provider: PROVIDER,
      existingUser: { id: 'u1', email: 'a@example.com', name: 'A' },
      identity: { externalId: 'ext-1', attributes: { email: 'a@example.com' } },
    })
    const result = await service.authenticate('org-1', 'cas', { ticket: 't' })
    expect(result).toMatchObject({ created: false, user: { id: 'u1' } })
    expect(users.create).not.toHaveBeenCalled()
  })

  it('无 link/用户 → JIT 建号，只给默认角色', async () => {
    const { service, users, roles } = setup({
      provider: PROVIDER,
      role: { id: 'role-student', name: 'student' },
      identity: { externalId: 'ext-1', attributes: { email: 'new@example.com', name: 'New' } },
    })
    const result = await service.authenticate('org-1', 'cas', { ticket: 't' })
    expect(result.created).toBe(true)
    expect(roles.findByName).toHaveBeenCalledWith('student', 'org-1')
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', roleId: 'role-student' }),
      'org-1',
    )
  })

  it('默认角色不存在 → fail-closed', async () => {
    const { service } = setup({
      provider: PROVIDER,
      role: null,
      identity: { externalId: 'ext-1', attributes: { email: 'new@example.com' } },
    })
    await expect(service.authenticate('org-1', 'cas', { ticket: 't' })).rejects.toThrow(
      /默认角色不存在/,
    )
  })

  it('provider 停用/不存在 → fail-closed', async () => {
    const { service } = setup({ provider: null })
    await expect(service.authenticate('org-1', 'cas', { ticket: 't' })).rejects.toThrow(
      /不存在或已停用/,
    )
  })
})
