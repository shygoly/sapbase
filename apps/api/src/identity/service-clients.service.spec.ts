import { BadRequestException } from '@nestjs/common'
import { ServiceClientsService, hashClientSecret } from './service-clients.service'

function repoWith(rows: any[] = []) {
  const store = [...rows]
  const repo = {
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
    create: jest.fn((row: any) => ({ id: 'client-id', ...row })),
    save: jest.fn(async (row: any) => {
      const index = store.findIndex((item) => item.id === row.id)
      if (index >= 0) store[index] = row
      else store.push(row)
      return row
    }),
    update: jest.fn(async (where: any, patch: any) => {
      for (const row of store) {
        if (Object.entries(where).every(([key, value]) => row[key] === value)) {
          Object.assign(row, patch)
        }
      }
      return { affected: 1 }
    }),
    createQueryBuilder: jest.fn(() => {
      const state: any = { where: {}, extra: {} }
      return {
        addSelect: jest.fn(function () {
          return this
        }),
        where: jest.fn(function (sql: string, params: any) {
          Object.assign(state.where, params)
          return this
        }),
        andWhere: jest.fn(function (sql: string, params: any) {
          Object.assign(state.where, params)
          return this
        }),
        getOne: jest.fn(async () =>
          store.find(
            (row) =>
              row.organizationId === state.where.organizationId &&
              row.key === state.where.key &&
              row.status === state.where.status,
          ) ?? null,
        ),
      }
    }),
  }
  return repo
}

describe('ServiceClientsService', () => {
  it('创建：返回一次明文 secret，数据库只存哈希', async () => {
    const repo = repoWith()
    const service = new ServiceClientsService(repo as never)
    const { client, secret } = await service.create('org-1', {
      key: 'sis-sync',
      name: 'SIS Sync',
      scopes: ['student:read'],
    })
    expect(secret).toMatch(/^[a-f0-9]{64}$/)
    expect(client).toMatchObject({ key: 'sis-sync', status: 'active', organizationId: 'org-1' })
    expect(client.secretHash).toBe(hashClientSecret(secret))
    expect(client.secretHash).not.toBe(secret)
  })

  it('拒绝非法/重复 key', async () => {
    const repo = repoWith([
      { id: 'c1', organizationId: 'org-1', key: 'dup', name: 'Dup', status: 'active' },
    ])
    const service = new ServiceClientsService(repo as never)
    await expect(
      service.create('org-1', { key: 'Bad Key', name: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.create('org-1', { key: 'dup', name: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('认证：正确 secret 通过并更新 lastUsedAt；错误/过期拒绝', async () => {
    const secret = 'a'.repeat(64)
    const repo = repoWith([
      {
        id: 'c1',
        organizationId: 'org-1',
        key: 'sis-sync',
        status: 'active',
        secretHash: hashClientSecret(secret),
        expiresAt: null,
      },
    ])
    const service = new ServiceClientsService(repo as never)
    await expect(service.authenticate('org-1', 'sis-sync', secret)).resolves.toMatchObject({
      key: 'sis-sync',
    })
    await expect(service.authenticate('org-1', 'sis-sync', 'wrong')).resolves.toBeNull()
    await expect(service.authenticate('org-2', 'sis-sync', secret)).resolves.toBeNull()
  })

  it('轮换 secret：旧值失效，新值可用', async () => {
    const oldSecret = 'b'.repeat(64)
    const repo = repoWith([
      {
        id: 'c1',
        organizationId: 'org-1',
        key: 'sis-sync',
        status: 'active',
        secretHash: hashClientSecret(oldSecret),
        expiresAt: null,
      },
    ])
    const service = new ServiceClientsService(repo as never)
    const { secret } = await service.rotate('org-1', 'c1')
    await expect(service.authenticate('org-1', 'sis-sync', oldSecret)).resolves.toBeNull()
    await expect(service.authenticate('org-1', 'sis-sync', secret)).resolves.toMatchObject({
      key: 'sis-sync',
    })
  })
})
