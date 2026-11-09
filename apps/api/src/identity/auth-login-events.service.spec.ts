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
