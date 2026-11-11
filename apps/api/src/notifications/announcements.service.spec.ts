import { BadRequestException, ConflictException } from '@nestjs/common'
import { AnnouncementsService } from './announcements.service'

function repos(options: {
  announcement?: any
  audiences?: any[]
  deliveries?: any[]
  members?: any[]
  roleBindings?: any[]
  scopeNodes?: any[]
  scopeMemberships?: any[]
  jobs?: any
  scheduled?: any[]
} = {}) {
  const announcements = {
    find: jest.fn(async () => options.scheduled ?? []),
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
    update: jest.fn(async () => ({ affected: deliveryStore.length })),
    findAndCount: jest.fn(async ({ skip, take }: any) => [
      deliveryStore.slice(skip, skip + take),
      deliveryStore.length,
    ]),
  }
  const members = { find: jest.fn(async () => options.members ?? []) }
  const memberRoles = { find: jest.fn(async () => options.roleBindings ?? []) }
  const scopeNodeStore = [...(options.scopeNodes ?? [])]
  const scopeNodes = {
    findOne: jest.fn(async ({ where }: any) =>
      scopeNodeStore.find(
        (row) => row.id === where.id && row.organizationId === where.organizationId,
      ) ?? null,
    ),
    find: jest.fn(async ({ where }: any) =>
      scopeNodeStore.filter(
        (row) =>
          row.organizationId === where.organizationId &&
          row.dimensionId === where.dimensionId &&
          String(row.path).startsWith(String(where.path?.value ?? where.path).replace('%', '')),
      ),
    ),
  }
  const scopeMemberships = {
    find: jest.fn(async ({ where }: any) => {
      const ids = where.nodeId?._value ?? where.nodeId?.value ?? []
      return (options.scopeMemberships ?? []).filter((row) => ids.includes(row.nodeId))
    }),
  }
  const notifications = {
    sendToUser: jest.fn(async () => undefined),
    sendToUsers: jest.fn(
      async (
        _userIds: string[],
        _notification: Record<string, unknown>,
        _sourceEventId?: string,
      ) => undefined,
    ),
  }
  return {
    service: new AnnouncementsService(
      announcements as never,
      audiences as never,
      deliveries as never,
      members as never,
      memberRoles as never,
      scopeNodes as never,
      scopeMemberships as never,
      notifications as never,
      options.jobs as never,
    ),
    announcements,
    audiences,
    deliveries,
    members,
    memberRoles,
    scopeNodes,
    scopeMemberships,
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
    expect(notifications.sendToUsers).toHaveBeenCalledTimes(1)
    expect(deliveries.save).toHaveBeenCalledTimes(1)
    expect(deliveries.save.mock.calls[0][0]).toHaveLength(2)
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
    expect(notifications.sendToUsers).toHaveBeenCalledTimes(1)
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
    expect(notifications.sendToUsers).not.toHaveBeenCalled()
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

  it('scope_node audience：按节点成员（含角色成员）展开', async () => {
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
        {
          organizationId: 'org-1',
          announcementId: 'ann-1',
          audienceType: 'scope_node',
          audienceValue: '11111111-1111-4111-8111-111111111111',
        },
      ],
      scopeNodes: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          organizationId: 'org-1',
          dimensionId: 'dim-1',
          path: '/root',
        },
      ],
      scopeMemberships: [
        {
          organizationId: 'org-1',
          nodeId: '11111111-1111-4111-8111-111111111111',
          subjectType: 'user',
          subjectId: 'u1',
          validFrom: null,
          validTo: null,
        },
        {
          organizationId: 'org-1',
          nodeId: '11111111-1111-4111-8111-111111111111',
          subjectType: 'role',
          subjectId: 'teacher',
          validFrom: null,
          validTo: null,
        },
      ],
      roleBindings: [{ userId: 'u2' }],
    })
    const result = await service.publish('org-1', 'ann-1')
    expect(result.delivered).toBe(2)
    const sent = notifications.sendToUsers.mock.calls[0][0]
    expect(sent.sort()).toEqual(['u1', 'u2'])
  })

  it('scope_subtree audience：展开后代节点成员', async () => {
    const { service, notifications } = repos({
      announcement: {
        id: 'ann-1',
        organizationId: 'org-1',
        title: 'T',
        body: 'B',
        status: 'draft',
        audienceType: 'scope_subtree',
      },
      audiences: [
        {
          organizationId: 'org-1',
          announcementId: 'ann-1',
          audienceType: 'scope_subtree',
          audienceValue: '11111111-1111-4111-8111-111111111111',
        },
      ],
      scopeNodes: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          organizationId: 'org-1',
          dimensionId: 'dim-1',
          path: '/root',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          organizationId: 'org-1',
          dimensionId: 'dim-1',
          path: '/root/child',
        },
      ],
      scopeMemberships: [
        {
          organizationId: 'org-1',
          nodeId: '22222222-2222-4222-8222-222222222222',
          subjectType: 'user',
          subjectId: 'u1',
          validFrom: null,
          validTo: null,
        },
      ],
    })
    const result = await service.publish('org-1', 'ann-1')
    expect(result.delivered).toBe(1)
    expect(notifications.sendToUsers.mock.calls[0][0]).toEqual(['u1'])
  })

  it('scope audience 跨租户/不存在节点：创建时拒绝（404），不落 audience', async () => {
    const { service, audiences } = repos({ scopeNodes: [] })
    await expect(
      service.create('org-1', 'u1', {
        title: 'T',
        body: 'B',
        audienceType: 'scope_node',
        audiences: [
          {
            type: 'scope_node',
            value: '33333333-3333-4333-8333-333333333333',
          },
        ],
      }),
    ).rejects.toThrow('Scope node not found')
    expect(audiences.save).not.toHaveBeenCalled()
  })

  it('定时发布：publishAt 在未来只置 scheduled，不扇出', async () => {
    const future = new Date(Date.now() + 60_000)
    const { service, notifications, announcements } = repos({
      announcement: {
        id: 'ann-1',
        organizationId: 'org-1',
        title: 'T',
        body: 'B',
        status: 'draft',
        audienceType: 'all',
        publishAt: future,
      },
      members: [{ userId: 'u1' }],
    })
    const result = await service.publish('org-1', 'ann-1')
    expect(result.scheduled).toBe(true)
    expect(notifications.sendToUsers).not.toHaveBeenCalled()
    expect(announcements.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'scheduled' }),
    )
  })

  it('复制：正文/受众/附件/保留期复用，标题加副本前缀', async () => {
    const { service, audiences } = repos({
      announcement: {
        id: 'ann-1',
        organizationId: 'org-1',
        title: '原公告',
        body: 'B',
        status: 'published',
        audienceType: 'role',
        retentionDays: 60,
        attachments: [{ name: 'a.pdf', url: 'https://example.com/a.pdf' }],
      },
      audiences: [
        {
          organizationId: 'org-1',
          announcementId: 'ann-1',
          audienceType: 'role',
          audienceValue: 'teacher',
        },
      ],
    })
    const copied = await service.copy('org-1', 'ann-1', 'u1')
    expect(copied.title).toBe('副本 - 原公告')
    expect(copied.retentionDays).toBe(60)
    expect(audiences.save).toHaveBeenCalledWith(
      expect.objectContaining({ audienceType: 'role', audienceValue: 'teacher' }),
    )
  })

  it('删除：已发布先撤回；草稿软删除 delivery', async () => {
    const { service, announcements, deliveries } = repos({
      announcement: {
        id: 'ann-1',
        organizationId: 'org-1',
        title: 'T',
        body: 'B',
        status: 'published',
      },
    })
    await expect(service.remove('org-1', 'ann-1')).rejects.toBeInstanceOf(ConflictException)

    const draft = repos({
      announcement: {
        id: 'ann-2',
        organizationId: 'org-1',
        title: 'T',
        body: 'B',
        status: 'draft',
      },
    })
    await expect(draft.service.remove('org-1', 'ann-2')).resolves.toEqual({
      id: 'ann-2',
      deleted: true,
    })
    expect(draft.announcements.save).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    )
    expect(draft.deliveries.update).toHaveBeenCalledWith(
      { organizationId: 'org-1', announcementId: 'ann-2' },
      { deletedAt: expect.any(Date) },
    )
    void announcements
    void deliveries
  })

  it('投递明细分页：返回 page/pageSize/total', async () => {
    const { service } = repos({
      announcement: {
        id: 'ann-1',
        organizationId: 'org-1',
        title: 'T',
        body: 'B',
        status: 'published',
      },
      deliveries: [
        { id: 'd1', announcementId: 'ann-1', userId: 'u1', status: 'read' },
        { id: 'd2', announcementId: 'ann-1', userId: 'u2', status: 'delivered' },
      ],
    })
    const page = await service.deliveriesPage('org-1', 'ann-1', { page: 2, pageSize: 1 })
    expect(page.total).toBe(2)
    expect(page.page).toBe(2)
    expect(page.pageSize).toBe(1)
    expect(page.items).toHaveLength(1)
  })

  it('附件：只允许 http/https', async () => {
    const { service } = repos()
    await expect(
      service.create('org-1', 'u1', {
        title: 'T',
        body: 'B',
        attachments: [{ name: 'x', url: 'javascript:alert(1)' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('大组织阈值：走 async-job 扇出并返回 jobId', async () => {
    const previousEnabled = process.env.JOBS_WORKER_ENABLED
    const previousThreshold = process.env.ANNOUNCEMENT_FANOUT_JOB_THRESHOLD
    process.env.JOBS_WORKER_ENABLED = 'true'
    process.env.ANNOUNCEMENT_FANOUT_JOB_THRESHOLD = '1'
    try {
      const jobs = {
        create: jest.fn(async () => ({ job: { id: 'job-1' }, created: true })),
      }
      const { service, notifications } = repos({
        jobs,
        announcement: {
          id: 'ann-1',
          organizationId: 'org-1',
          title: 'T',
          body: 'B',
          status: 'draft',
          audienceType: 'all',
          createdBy: 'u1',
        },
        members: [{ userId: 'u1' }, { userId: 'u2' }],
      })
      const result = await service.publish('org-1', 'ann-1')
      expect(result.queued).toBe(true)
      expect(result.jobId).toBe('job-1')
      expect(jobs.create).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ userId: 'u1' }),
        expect.objectContaining({
          type: 'notification.announcement_fanout',
          idempotencyKey: 'announcement-fanout:ann-1',
        }),
      )
      expect(notifications.sendToUsers).not.toHaveBeenCalled()
    } finally {
      if (previousEnabled === undefined) delete process.env.JOBS_WORKER_ENABLED
      else process.env.JOBS_WORKER_ENABLED = previousEnabled
      if (previousThreshold === undefined) delete process.env.ANNOUNCEMENT_FANOUT_JOB_THRESHOLD
      else process.env.ANNOUNCEMENT_FANOUT_JOB_THRESHOLD = previousThreshold
    }
  })

  it('发布限流：同一组织每分钟超过 30 次返回 429', async () => {
    const { service } = repos({
      announcement: {
        id: 'ann-1',
        organizationId: 'org-1',
        title: 'T',
        body: 'B',
        status: 'published',
        audienceType: 'all',
      },
    })
    for (let index = 0; index < 30; index++) {
      await service.publish('org-1', 'ann-1')
    }
    await expect(service.publish('org-1', 'ann-1')).rejects.toMatchObject({ status: 429 })
  })

  it('扇出取消：分批循环在 isCancelled 后停止，已投递批次保留', async () => {
    const recipients = Array.from({ length: 250 }, (_, index) => `u${index}`)
    const { service, notifications } = repos({
      announcement: {
        id: 'ann-1',
        organizationId: 'org-1',
        title: 'T',
        body: 'B',
        status: 'published',
        audienceType: 'user',
      },
      audiences: recipients.map((userId) => ({
        organizationId: 'org-1',
        announcementId: 'ann-1',
        audienceType: 'user',
        audienceValue: userId,
      })),
    })
    let checks = 0
    const delivered = await service.fanout(
      'org-1',
      {
        id: 'ann-1',
        organizationId: 'org-1',
        title: 'T',
        body: 'B',
      } as never,
      recipients,
      {
        progress: jest.fn(async () => undefined),
        isCancelled: async () => {
          checks += 1
          return checks > 1
        },
      },
    )
    expect(delivered).toBe(100)
    expect(notifications.sendToUsers).toHaveBeenCalledTimes(1)
  })

  it('定时发布：publishDue 只发布 publishAt <= now 的 scheduled 公告', async () => {
    const now = new Date('2026-11-11T10:00:00Z')
    const due = {
      id: 'ann-1',
      organizationId: 'org-1',
      title: 'T',
      body: 'B',
      status: 'scheduled',
      audienceType: 'all',
      publishAt: new Date('2026-11-11T09:00:00Z'),
    }
    const future = {
      id: 'ann-2',
      organizationId: 'org-1',
      title: 'F',
      body: 'B',
      status: 'scheduled',
      audienceType: 'all',
      publishAt: new Date('2026-11-11T11:00:00Z'),
    }
    const { service, notifications, announcements } = repos({
      announcement: due,
      scheduled: [due, future],
      members: [{ userId: 'u1' }],
    })
    await expect(service.publishDue(now)).resolves.toBe(1)
    expect(notifications.sendToUsers).toHaveBeenCalledTimes(1)
    expect(announcements.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ann-1', status: 'published' }),
    )
  })
})
