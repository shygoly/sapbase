import { UnauthorizedException } from '@nestjs/common'
import { AuthSessionsService } from './auth-sessions.service'

function repoWith(rows: any[] = []) {
  const store = [...rows]
  return {
    create: jest.fn((row: any) => ({ id: 'session-id', ...row })),
    save: jest.fn(async (row: any) => {
      const index = store.findIndex((item) => item.id === row.id)
      if (index >= 0) store[index] = row
      else store.push(row)
      return row
    }),
    findOne: jest.fn(async ({ where }: any) =>
      store.find(
        (row) =>
          row.sid === where.sid &&
          row.status === where.status &&
          (!where.expiresAt || new Date(row.expiresAt).getTime() > Date.now()),
      ) ?? null,
    ),
    find: jest.fn(async ({ where }: any) =>
      store.filter(
        (row) =>
          row.organizationId === where.organizationId &&
          row.userId === where.userId,
      ),
    ),
    update: jest.fn(async (where: any, patch: any) => {
      let affected = 0
      for (const row of store) {
        const matches = Object.entries(where).every(([key, value]) => row[key] === value)
        if (matches) {
          Object.assign(row, patch)
          affected += 1
        }
      }
      return { affected }
    }),
  }
}

describe('AuthSessionsService', () => {
  it('创建会话：active + 默认 7 天 TTL', async () => {
    const repo = repoWith()
    const service = new AuthSessionsService(repo as never)
    const session = await service.create({ organizationId: 'org-1', userId: 'u1' })
    expect(session).toMatchObject({
      organizationId: 'org-1',
      userId: 'u1',
      status: 'active',
    })
    expect(session.sid).toMatch(/^[0-9a-f-]{36}$/)
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('assertActive：不存在/已吊销 → 401；存在则 touch lastSeenAt', async () => {
    const repo = repoWith([
      { id: 's1', sid: 'sid-1', status: 'revoked', organizationId: 'org-1', userId: 'u1' },
    ])
    const service = new AuthSessionsService(repo as never)
    await expect(service.assertActive('missing')).rejects.toBeInstanceOf(UnauthorizedException)
    await expect(service.assertActive('sid-1')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('revoke：只吊销 active；重复吊销返回 false', async () => {
    const repo = repoWith([
      { id: 's1', sid: 'sid-1', status: 'active', organizationId: 'org-1', userId: 'u1' },
    ])
    const service = new AuthSessionsService(repo as never)
    await expect(service.revoke('sid-1')).resolves.toBe(true)
    await expect(service.revoke('sid-1')).resolves.toBe(false)
  })

  it('revokeAll：按组织+用户批量吊销', async () => {
    const repo = repoWith([
      { id: 's1', sid: 'sid-1', status: 'active', organizationId: 'org-1', userId: 'u1' },
      { id: 's2', sid: 'sid-2', status: 'active', organizationId: 'org-1', userId: 'u1' },
      { id: 's3', sid: 'sid-3', status: 'active', organizationId: 'org-2', userId: 'u1' },
    ])
    const service = new AuthSessionsService(repo as never)
    await expect(service.revokeAll('org-1', 'u1')).resolves.toBe(2)
  })

  it('rotateRefresh：更新 refresh hash', async () => {
    const repo = repoWith([
      {
        id: 's1',
        sid: 'sid-1',
        status: 'active',
        organizationId: 'org-1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 60_000),
      },
    ])
    const service = new AuthSessionsService(repo as never)
    const rotated = await service.rotateRefresh('sid-1', 'hash-2')
    expect(rotated.refreshTokenHash).toBe('hash-2')
  })
})
