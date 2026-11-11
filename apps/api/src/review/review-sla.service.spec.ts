import { ReviewSlaService } from './review-sla.service'

function setup(rows: any[], roleRows: any[] = [{ userId: 'u1', roleName: 'teacher', status: 'active' }]) {
  const notifications = { sendToUser: jest.fn(async () => undefined) }
  const workItems = { project: jest.fn(async (row) => row) }
  const service = new ReviewSlaService(
    { find: jest.fn(async () => rows), save: jest.fn(async (row) => row) } as never,
    { find: jest.fn(async () => roleRows) } as never,
    notifications as never,
    workItems as never,
  )
  return { service, notifications, workItems }
}

function approval(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ap-1',
    organizationId: 'org-1',
    entity: 'order',
    recordId: 'rec-1',
    ruleId: 'rule-1',
    round: 1,
    role: 'teacher',
    status: 'pending',
    dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    reminderSentAt: null,
    escalatedAt: null,
    ...overrides,
  }
}

describe('ReviewSlaService', () => {
  it('到期前提醒只发一次', async () => {
    const row = approval()
    const { service, notifications } = setup([row])
    await expect(service.scan()).resolves.toEqual({ reminded: 1, escalated: 0 })
    expect(notifications.sendToUser).toHaveBeenCalledTimes(1)
    const second = await service.scan()
    expect(second.reminded).toBe(0)
    expect(notifications.sendToUser).toHaveBeenCalledTimes(1)
  })

  it('超时升级：通知 + 工作项 urgent', async () => {
    const row = approval({ dueAt: new Date(Date.now() - 60_000) })
    const { service, workItems } = setup([row])
    await expect(service.scan()).resolves.toEqual({ reminded: 0, escalated: 1 })
    expect(workItems.project).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: 'approval', priority: 'urgent' }),
    )
  })

  it('无审批人时回退 Admin 角色；仍无接收人不静默通过', async () => {
    const row = approval({ dueAt: new Date(Date.now() - 60_000), role: 'teacher' })
    const { service, notifications } = setup([row], [])
    await expect(service.scan()).resolves.toEqual({ reminded: 0, escalated: 1 })
    expect(notifications.sendToUser).not.toHaveBeenCalled()
  })

  it('未到提醒窗口不处理', async () => {
    const row = approval({ dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000) })
    const { service, notifications } = setup([row])
    await expect(service.scan()).resolves.toEqual({ reminded: 0, escalated: 0 })
    expect(notifications.sendToUser).not.toHaveBeenCalled()
  })
})
