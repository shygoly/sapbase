import { NotificationRetentionService } from './notification-retention.service'

function setup(queryImpl?: (sql: string, params: unknown[]) => Promise<unknown[]>) {
  const calls: Array<{ sql: string; params: unknown[] }> = []
  const manager = {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params })
      return queryImpl ? queryImpl(sql, params) : []
    }),
  }
  const runs = {
    create: jest.fn((row: Record<string, unknown>) => ({ id: 'run-1', ...row })),
    save: jest.fn(async (row: Record<string, unknown>) => row),
  }
  const service = new NotificationRetentionService(
    { manager } as never,
    {} as never,
    {} as never,
    runs as never,
    {} as never,
  )
  return { service, calls, manager, runs }
}

describe('NotificationRetentionService', () => {
  it('到期清理：过期公告 + 软删除公告/投递/通知，并写清理运行记录', async () => {
    const { service, calls, runs } = setup(async (sql) => {
      if (sql.includes('UPDATE public.announcements') && sql.includes("status = 'expired'")) {
        return [{ id: 'ann-1' }]
      }
      if (sql.includes('UPDATE public.announcements')) return [{ id: 'ann-2' }]
      if (sql.includes('UPDATE public.announcement_deliveries')) return [{ id: 'd-1' }]
      if (sql.includes('UPDATE public.notifications')) return [{ id: 'n-1' }]
      return []
    })
    const result = await service.cleanupOrganization('org-1', new Date('2026-11-11T03:15:00Z'), 30)
    expect(result).toMatchObject({
      organizationId: 'org-1',
      announcementsExpired: 1,
      announcementsDeleted: 1,
      deliveriesDeleted: 1,
      notificationsDeleted: 1,
    })
    expect(calls.map((call) => call.sql)).toEqual([
      expect.stringContaining("SET status = 'expired'"),
      expect.stringContaining('SET "deletedAt" = $2'),
      expect.stringContaining('UPDATE public.announcement_deliveries'),
      expect.stringContaining('UPDATE public.notifications'),
    ])
    expect(runs.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        notificationRetentionDays: 30,
        notificationsDeleted: 1,
        deliveriesDeleted: 1,
        announcementsExpired: 1,
        announcementsDeleted: 1,
      }),
    )
  })

  it('分批：每批 500，直到不足一批', async () => {
    let batch = 0
    const { service, calls } = setup(async (sql) => {
      if (!sql.includes('UPDATE public.notifications')) return []
      batch += 1
      if (batch === 1) return Array.from({ length: 500 }, (_, index) => ({ id: `n-${index}` }))
      return [{ id: 'n-last' }]
    })
    const result = await service.cleanupOrganization('org-1', new Date('2026-11-11T03:15:00Z'), 30)
    expect(result.notificationsDeleted).toBe(501)
    expect(calls.filter((call) => call.sql.includes('UPDATE public.notifications'))).toHaveLength(2)
  })

  it('保留期延长：60 天作为参数下推，不删 30–60 天窗口内的通知', async () => {
    const { service, calls } = setup()
    await service.cleanupOrganization('org-1', new Date('2026-11-11T03:15:00Z'), 60)
    const notificationCall = calls.find((call) => call.sql.includes('UPDATE public.notifications'))
    expect(notificationCall?.params).toEqual([
      'org-1',
      new Date('2026-11-11T03:15:00Z'),
      60,
    ])
  })

  it('失败：运行记录标 failed 并保留错误，异常向上抛', async () => {
    const { service, runs } = setup(async (sql) => {
      if (sql.includes('UPDATE public.announcements')) throw new Error('db down')
      return []
    })
    await expect(
      service.cleanupOrganization('org-1', new Date('2026-11-11T03:15:00Z'), 30),
    ).rejects.toThrow('db down')
    expect(runs.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'failed', error: 'db down' }),
    )
  })
})
