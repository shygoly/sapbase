import { OrganizationMemberRolesService } from './organization-member-roles.service'

function repoWith(rows: any[] = []) {
  const store = [...rows]
  return {
    findOne: jest.fn(async ({ where }: any) =>
      store.find(
        (row) =>
          row.organizationId === where.organizationId &&
          row.userId === where.userId &&
          row.roleName === where.roleName,
      ) ?? null,
    ),
    find: jest.fn(async ({ where }: any) =>
      store.filter(
        (row) =>
          row.organizationId === where.organizationId &&
          (!where.userId || row.userId === where.userId) &&
          (!where.status || row.status === where.status),
      ),
    ),
    create: jest.fn((row: any) => ({ id: 'new-id', ...row })),
    save: jest.fn(async (row: any) => {
      const index = store.findIndex((item) => item.id === row.id)
      if (index >= 0) store[index] = row
      else store.push(row)
      return row
    }),
    update: jest.fn(async (where: any, patch: any) => {
      let affected = 0
      for (const row of store) {
        if (
          row.organizationId === where.organizationId &&
          row.userId === where.userId &&
          row.roleName === where.roleName &&
          row.status === where.status
        ) {
          Object.assign(row, patch)
          affected += 1
        }
      }
      return { affected }
    }),
  }
}

describe('OrganizationMemberRolesService', () => {
  it('授予：新绑定 active，默认 source=manual', async () => {
    const repo = repoWith()
    const service = new OrganizationMemberRolesService(repo as never)
    const row = await service.grant('org-1', 'u1', { roleName: 'teacher' })
    expect(row).toMatchObject({
      organizationId: 'org-1',
      userId: 'u1',
      roleName: 'teacher',
      status: 'active',
      source: 'manual',
    })
  })

  it('重复授予：复用同一行并重新激活', async () => {
    const repo = repoWith([
      {
        id: 'r1',
        organizationId: 'org-1',
        userId: 'u1',
        roleName: 'teacher',
        status: 'inactive',
        source: 'legacy',
      },
    ])
    const service = new OrganizationMemberRolesService(repo as never)
    const row = await service.grant('org-1', 'u1', { roleName: 'teacher' })
    expect(row.id).toBe('r1')
    expect(row.status).toBe('active')
    expect(repo.save).toHaveBeenCalledTimes(1)
  })

  it('撤销：只把匹配的 active 绑定置 inactive', async () => {
    const repo = repoWith([
      { id: 'r1', organizationId: 'org-1', userId: 'u1', roleName: 'teacher', status: 'active' },
    ])
    const service = new OrganizationMemberRolesService(repo as never)
    await expect(service.revoke('org-1', 'u1', 'teacher')).resolves.toBe(true)
    await expect(service.revoke('org-1', 'u1', 'ghost')).resolves.toBe(false)
  })

  it('有效角色：过滤 inactive、未生效、已过期，并去重', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const repo = repoWith([
      { id: '1', organizationId: 'org-1', userId: 'u1', roleName: 'teacher', status: 'active', validFrom: null, validTo: null },
      { id: '2', organizationId: 'org-1', userId: 'u1', roleName: 'teacher', status: 'active', validFrom: null, validTo: null },
      { id: '3', organizationId: 'org-1', userId: 'u1', roleName: 'old', status: 'active', validTo: '2025-01-01T00:00:00.000Z' },
      { id: '4', organizationId: 'org-1', userId: 'u1', roleName: 'future', status: 'active', validFrom: '2027-01-01T00:00:00.000Z' },
      { id: '5', organizationId: 'org-1', userId: 'u1', roleName: 'inactive', status: 'inactive' },
    ])
    const service = new OrganizationMemberRolesService(repo as never)
    await expect(service.activeRoleNames('org-1', 'u1', now)).resolves.toEqual(['teacher'])
  })

  it('跨组织：只返回本组织绑定', async () => {
    const repo = repoWith([
      { id: '1', organizationId: 'org-1', userId: 'u1', roleName: 'teacher', status: 'active' },
      { id: '2', organizationId: 'org-2', userId: 'u1', roleName: 'admin', status: 'active' },
    ])
    const service = new OrganizationMemberRolesService(repo as never)
    await expect(service.activeRoleNames('org-1', 'u1')).resolves.toEqual(['teacher'])
  })
})
