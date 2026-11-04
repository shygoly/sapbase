import { NotFoundException } from '@nestjs/common'
import { NotificationsController } from './notifications.controller'

describe('NotificationsController', () => {
  it('缺用户或租户 → 空列表（fail-closed）', async () => {
    const notifications = { listForUser: jest.fn(), markAsRead: jest.fn() }
    const controller = new NotificationsController(notifications as never)
    expect(await controller.list(undefined, {})).toEqual({ notifications: [] })
    expect(await controller.list(undefined, { id: 'u1' })).toEqual({ notifications: [] })
    expect(notifications.listForUser).not.toHaveBeenCalled()
  })

  it('默认未读；?all=true 含已读', async () => {
    const notifications = {
      listForUser: jest.fn(async (_u: string, _o: string, all: boolean) =>
        all ? [{ id: 'n1', read: true }] : [{ id: 'n2', read: false }],
      ),
      markAsRead: jest.fn(),
    }
    const controller = new NotificationsController(notifications as never)
    const unread = await controller.list(undefined, { id: 'u1', organizationId: 'org-1' })
    expect(notifications.listForUser).toHaveBeenCalledWith('u1', 'org-1', false)
    expect(unread.notifications[0].read).toBe(false)

    const all = await controller.list('true', { userId: 'u1', organizationId: 'org-1' })
    expect(notifications.listForUser).toHaveBeenCalledWith('u1', 'org-1', true)
    expect(all.notifications[0].read).toBe(true)
  })

  it('负例：已读越权 / 不存在 → 404，不泄露', async () => {
    const notifications = {
      listForUser: jest.fn(),
      markAsRead: jest.fn(async () => false),
    }
    const controller = new NotificationsController(notifications as never)
    await expect(controller.markRead('n-other', { id: 'u1', organizationId: 'org-1' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    await expect(controller.markRead('n1', {})).rejects.toBeInstanceOf(NotFoundException)
  })
})
