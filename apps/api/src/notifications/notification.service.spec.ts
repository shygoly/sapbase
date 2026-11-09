import { NotificationService } from '../websocket/services/notification.service'

function dataSourceWith(repo: any) {
  return { getRepository: jest.fn(() => repo) }
}

describe('NotificationService center helpers', () => {
  it('unreadCount 按组织/用户/未读计数', async () => {
    const count = jest.fn(async () => 3)
    const service = new NotificationService(dataSourceWith({ count }) as never)
    await expect(service.unreadCount('u1', 'org-1')).resolves.toBe(3)
    expect(count).toHaveBeenCalledWith({
      where: { userId: 'u1', organizationId: 'org-1', read: false },
    })
  })

  it('markAllRead 更新 readAt', async () => {
    const update = jest.fn(async () => ({ affected: 2 }))
    const service = new NotificationService(dataSourceWith({ update }) as never)
    await expect(service.markAllRead('u1', 'org-1')).resolves.toBe(2)
    expect(update).toHaveBeenCalledWith(
      { userId: 'u1', organizationId: 'org-1', read: false },
      { read: true, readAt: expect.any(Date) },
    )
  })

  it('markAsRead 写 readAt', async () => {
    const update = jest.fn(async () => ({ affected: 1 }))
    const service = new NotificationService(dataSourceWith({ update }) as never)
    await expect(service.markAsRead('u1', 'n1', 'org-1')).resolves.toBe(true)
    expect(update).toHaveBeenCalledWith(
      { id: 'n1', userId: 'u1', organizationId: 'org-1' },
      { read: true, readAt: expect.any(Date) },
    )
  })
})
