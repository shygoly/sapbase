import { BadRequestException, ConflictException } from '@nestjs/common'
import { AnnouncementsService } from './announcements.service'

function repos(options: {
  announcement?: any
  audiences?: any[]
  deliveries?: any[]
  members?: any[]
  roleBindings?: any[]
} = {}) {
  const announcements = {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => options.announcement ?? null),
    create: jest.fn((row) => ({ id: 'ann-1', ...row })),
    save: jest.fn(async (row) => row),
  }
  const audienceStore = [...(options.audiences ?? [])]
  const audiences = {
    find: jest.fn(async () => audienceStore),
    delete: jest.fn(async () => undefined),
    create: jest.fn((row) => ({ id: 'aud-1', ...row })),
    save: jest.fn(async (row) => {
      audienceStore.push(row)
      return row
    }),
  }
  const deliveryStore = [...(options.deliveries ?? [])]
  const deliveries = {
    find: jest.fn(async () => deliveryStore),
    count: jest.fn(async () => deliveryStore.length),
    findOne: jest.fn(async ({ where }: any) =>
      deliveryStore.find(
        (row) => row.announcementId === where.announcementId && row.userId === where.userId,
      ) ?? null,
    ),
    create: jest.fn((row) => ({ id: 'del-1', ...row })),
    save: jest.fn(async (row) => {
      const index = deliveryStore.findIndex((item) => item.id === row.id)
      if (index >= 0) deliveryStore[index] = row
      else deliveryStore.push(row)
      return row
    }),
  }
  const members = { find: jest.fn(async () => options.members ?? []) }
  const memberRoles = { find: jest.fn(async () => options.roleBindings ?? []) }
  const notifications = { sendToUser: jest.fn(async () => undefined) }
  return {
    service: new AnnouncementsService(
      announcements as never,
      audiences as never,
      deliveries as never,
      members as never,
      memberRoles as never,
      notifications as never,
    ),
    announcements,
    audiences,
    deliveries,
    members,
    memberRoles,
    notifications,
  }
}

describe('AnnouncementsService', () => {
  it('create：标题/正文必填', async () => {
    const { service } = repos()
    await expect(
      service.create('org-1', 'u1', { title: '', body: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('publish all：成员去重后逐用户通知并建 delivery', async () => {
    const { service, notifications, deliveries } = repos({
      announcement: {
        id: 'ann-1',
        organizationId: 'org-1',
        title: 'T',
        body: 'B',
        status: 'draft',
        audienceType: 'all',
      },
      members: [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u1' }],
    })
    const result = await service.publish('org-1', 'ann-1')
    expect(result.delivered).toBe(2)
    expect(notifications.sendToUser).toHaveBeenCalledTimes(2)
    expect(deliveries.save).toHaveBeenCalledTimes(2)
  })

  it('publish role：按 organization_member_roles 解析', async () => {
    const { service, notifications } = repos({
      announcement: {
        id: 'ann-1',
        organizationId: 'org-1',
        title: 'T',
        body: 'B',
        status: 'draft',
        audienceType: 'role',
      },
      audiences: [
        { organizationId: 'org-1', announcementId: 'ann-1', audienceType: 'role', audienceValue: 'teacher' },
      ],
      roleBindings: [{ userId: 'u1' }, { userId: 'u2' }],
    })
    const result = await service.publish('org-1', 'ann-1')
    expect(result.delivered).toBe(2)
    expect(notifications.sendToUser).toHaveBeenCalledTimes(2)
  })

  it('scope audience 未启用 → 空投递（不兜底全组织）', async () => {
    const { service, notifications } = repos({
      announcement: {
        id: 'ann-1',
        organizationId: 'org-1',
        title: 'T',
        body: 'B',
        status: 'draft',
        audienceType: 'scope_node',
      },
      audiences: [
        { organizationId: 'org-1', announcementId: 'ann-1', audienceType: 'scope_node', audienceValue: 'n1' },
      ],
    })
    const result = await service.publish('org-1', 'ann-1')
    expect(result.delivered).toBe(0)
    expect(notifications.sendToUser).not.toHaveBeenCalled()
  })

  it('withdraw：draft 不能撤回', async () => {
    const { service } = repos({
      announcement: { id: 'ann-1', organizationId: 'org-1', status: 'draft' },
    })
    await expect(service.withdraw('org-1', 'ann-1')).rejects.toBeInstanceOf(ConflictException)
  })

  it('stats：read 计入 delivered', async () => {
    const { service } = repos({
      announcement: { id: 'ann-1', organizationId: 'org-1', status: 'published' },
      deliveries: [
        { announcementId: 'ann-1', status: 'delivered' },
        { announcementId: 'ann-1', status: 'read' },
        { announcementId: 'ann-1', status: 'failed' },
      ],
    })
    await expect(service.stats('org-1', 'ann-1')).resolves.toEqual({
      total: 3,
      delivered: 2,
      read: 1,
      failed: 1,
    })
  })

  it('markRead：存在 delivery 才更新', async () => {
    const { service, deliveries } = repos({
      deliveries: [{ id: 'd1', announcementId: 'ann-1', userId: 'u1', status: 'delivered' }],
    })
    await expect(service.markRead('org-1', 'ann-1', 'u1')).resolves.toBe(true)
    expect(deliveries.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'read', readAt: expect.any(Date) }),
    )
    await expect(service.markRead('org-1', 'ann-1', 'u2')).resolves.toBe(false)
  })
})
