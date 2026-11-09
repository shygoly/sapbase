import { NotificationPreferencesService } from './notification-preferences.service'

function repoWith(rows: any[] = []) {
  const store = [...rows]
  return {
    find: jest.fn(async ({ where }: any) =>
      store.filter(
        (row) =>
          row.organizationId === where.organizationId &&
          (!where.userId || row.userId === where.userId),
      ),
    ),
    findOne: jest.fn(async ({ where }: any) =>
      store.find(
        (row) =>
          row.organizationId === where.organizationId &&
          row.userId === where.userId &&
          row.category === where.category,
      ) ?? null,
    ),
    create: jest.fn((row) => ({ id: 'pref-id', ...row })),
    save: jest.fn(async (row) => {
      const index = store.findIndex((item) => item.id === row.id)
      if (index >= 0) store[index] = row
      else store.push(row)
      return row
    }),
  }
}

describe('NotificationPreferencesService', () => {
  it('upsert：新建/更新分类偏好', async () => {
    const repo = repoWith()
    const service = new NotificationPreferencesService(repo as never)
    await service.upsert('org-1', 'u1', 'approval', { email: false })
    const updated = await service.upsert('org-1', 'u1', 'approval', { push: true })
    expect(updated).toMatchObject({ category: 'approval', email: false, push: true })
    expect(repo.save).toHaveBeenCalledTimes(2)
  })

  it('resolve：分类优先于 all；无配置默认 inApp/email true', async () => {
    const repo = repoWith([
      { id: 'p1', organizationId: 'org-1', userId: 'u1', category: 'all', inApp: true, email: true, push: false, mutedUntil: null },
      { id: 'p2', organizationId: 'org-1', userId: 'u1', category: 'approval', inApp: false, email: true, push: true, mutedUntil: null },
    ])
    const service = new NotificationPreferencesService(repo as never)
    await expect(service.resolve('org-1', 'u1', 'approval')).resolves.toEqual({
      inApp: false,
      email: true,
      push: true,
      muted: false,
    })
  })

  it('mutedUntil 生效；mandatory 绕过 mute', async () => {
    const repo = repoWith([
      {
        id: 'p1',
        organizationId: 'org-1',
        userId: 'u1',
        category: 'all',
        inApp: true,
        email: true,
        push: false,
        mutedUntil: new Date(Date.now() + 60_000),
      },
    ])
    const service = new NotificationPreferencesService(repo as never)
    await expect(service.resolve('org-1', 'u1', 'system')).resolves.toMatchObject({
      muted: true,
    })
    await expect(
      service.resolve('org-1', 'u1', 'system', true),
    ).resolves.toMatchObject({ muted: false })
  })
})
