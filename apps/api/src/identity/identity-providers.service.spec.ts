import { BadRequestException } from '@nestjs/common'
import { IdentityProvidersService } from './identity-providers.service'

function repoWith(rows: any[] = []) {
  const store = [...rows]
  return {
    find: jest.fn(async ({ where }: any) =>
      store.filter((row) => row.organizationId === where.organizationId),
    ),
    findOne: jest.fn(async ({ where }: any) =>
      store.find(
        (row) =>
          row.organizationId === where.organizationId &&
          (!where.id || row.id === where.id) &&
          (!where.key || row.key === where.key),
      ) ?? null,
    ),
    create: jest.fn((row: any) => ({ id: 'provider-id', ...row })),
    save: jest.fn(async (row: any) => {
      const index = store.findIndex((item) => item.id === row.id)
      if (index >= 0) store[index] = row
      else store.push(row)
      return row
    }),
    remove: jest.fn(async (row: any) => {
      const index = store.findIndex((item) => item.id === row.id)
      if (index >= 0) store.splice(index, 1)
      return row
    }),
  }
}

describe('IdentityProvidersService', () => {
  it('创建：key 合法、默认 active、secret 只存 ref', async () => {
    const repo = repoWith()
    const service = new IdentityProvidersService(repo as never)
    const row = await service.create('org-1', {
      key: 'school-cas',
      name: 'School CAS',
      type: 'cas',
      secretRef: 'SSO_CAS_SECRET',
      config: { baseUrl: 'https://sso.example.com' },
    })
    expect(row).toMatchObject({
      key: 'school-cas',
      type: 'cas',
      status: 'active',
      secretRef: 'SSO_CAS_SECRET',
    })
    expect(JSON.stringify(row)).not.toContain('plain-secret')
  })

  it('拒绝非法 key 与重复 key', async () => {
    const repo = repoWith([
      { id: 'p1', organizationId: 'org-1', key: 'dup', name: 'Dup', type: 'oidc', status: 'active' },
    ])
    const service = new IdentityProvidersService(repo as never)
    await expect(
      service.create('org-1', { key: 'Bad Key', name: 'x', type: 'cas' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.create('org-1', { key: 'dup', name: 'x', type: 'cas' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('更新与删除', async () => {
    const repo = repoWith([
      { id: 'p1', organizationId: 'org-1', key: 'cas', name: 'CAS', type: 'cas', status: 'active' },
    ])
    const service = new IdentityProvidersService(repo as never)
    const updated = await service.update('org-1', 'p1', {
      name: 'CAS 2',
      status: 'inactive',
      defaultRoleName: 'student',
    })
    expect(updated).toMatchObject({ name: 'CAS 2', status: 'inactive', defaultRoleName: 'student' })
    await service.remove('org-1', 'p1')
    await expect(service.findOne('org-1', 'p1')).rejects.toThrow(/not found/)
  })

  it('按 key 查找只命中本组织', async () => {
    const repo = repoWith([
      { id: 'p1', organizationId: 'org-1', key: 'cas', name: 'CAS', type: 'cas', status: 'active' },
      { id: 'p2', organizationId: 'org-2', key: 'cas', name: 'Other', type: 'cas', status: 'active' },
    ])
    const service = new IdentityProvidersService(repo as never)
    await expect(service.findByKey('org-1', 'cas')).resolves.toMatchObject({ id: 'p1' })
    await expect(service.findByKey('org-2', 'cas')).resolves.toMatchObject({ id: 'p2' })
  })
})
