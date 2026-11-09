import { AuthLoginEventsService } from './auth-login-events.service'

describe('AuthLoginEventsService', () => {
  it('记录成功/失败事件，默认 provider=password', async () => {
    const create = jest.fn((row) => ({ id: 'e1', ...row }))
    const save = jest.fn(async (row) => row)
    const service = new AuthLoginEventsService({ create, save } as never)
    const row = await service.record({
      organizationId: 'org-1',
      email: 'a@example.com',
      status: 'success',
    })
    expect(row).toMatchObject({
      organizationId: 'org-1',
      email: 'a@example.com',
      provider: 'password',
      status: 'success',
    })
  })


  it('连续失败达到阈值 → 锁定', async () => {
    const now = Date.now()
    const find = jest.fn(async () => [
      { status: 'failure', createdAt: new Date(now - 60_000) },
      { status: 'failure', createdAt: new Date(now - 120_000) },
      { status: 'failure', createdAt: new Date(now - 180_000) },
      { status: 'failure', createdAt: new Date(now - 240_000) },
      { status: 'failure', createdAt: new Date(now - 300_000) },
    ])
    const service = new AuthLoginEventsService({ find } as never)
    await expect(service.isLocked('org-1', 'a@example.com')).resolves.toBe(true)
  })

  it('最近一次成功之后的失败才计数', async () => {
    const now = Date.now()
    const find = jest.fn(async () => [
      { status: 'failure', createdAt: new Date(now - 30_000) },
      { status: 'success', createdAt: new Date(now - 60_000) },
      { status: 'failure', createdAt: new Date(now - 120_000) },
      { status: 'failure', createdAt: new Date(now - 180_000) },
      { status: 'failure', createdAt: new Date(now - 240_000) },
      { status: 'failure', createdAt: new Date(now - 300_000) },
    ])
    const service = new AuthLoginEventsService({ find } as never)
    await expect(service.isLocked('org-1', 'a@example.com', { maxFailures: 3 })).resolves.toBe(false)
  })

  it('窗口外失败不计数', async () => {
    const now = Date.now()
    const find = jest.fn(async () => [
      { status: 'failure', createdAt: new Date(now - 30 * 60_000) },
      { status: 'failure', createdAt: new Date(now - 31 * 60_000) },
    ])
    const service = new AuthLoginEventsService({ find } as never)
    await expect(
      service.isLocked('org-1', 'a@example.com', { maxFailures: 1, windowMinutes: 15 }),
    ).resolves.toBe(false)
  })

  it('列表按用户过滤并限制条数', async () => {
    const find = jest.fn(async () => [])
    const service = new AuthLoginEventsService({ find } as never)
    await service.list('org-1', { userId: 'u1', limit: 999 })
    expect(find).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'u1' },
      order: { createdAt: 'DESC' },
      take: 200,
    })
  })
})
