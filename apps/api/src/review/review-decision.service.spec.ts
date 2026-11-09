import { ConflictException, ForbiddenException } from '@nestjs/common'
import { ReviewDecisionService } from './review-decision.service'

function setup(overrides: { approval?: any } = {}) {
  const store: any[] = []
  const approval = overrides.approval ?? {
    id: 'a1',
    organizationId: 'org-1',
    recordId: 'r1',
    role: 'teacher',
    status: 'pending',
    round: 1,
    selector: null,
    assignee: null,
    comment: null,
  }
  const approvals = {
    findOne: jest.fn(async () => approval),
    save: jest.fn(async (row) => row),
  }
  const events = { create: jest.fn((row) => ({ id: 'e1', ...row })), save: jest.fn(async (row) => row) }
  const comments = { create: jest.fn((row) => ({ id: 'c1', ...row })), save: jest.fn(async (row) => row) }
  const workItems = { close: jest.fn(async () => true) }
  return {
    service: new ReviewDecisionService(
      approvals as never,
      events as never,
      comments as never,
      workItems as never,
    ),
    approval,
    events,
    comments,
    workItems,
  }
}

describe('ReviewDecisionService', () => {
  it('approve：写状态/actor/decidedBy/事件并关闭工作项', async () => {
    const { service, approval, events, workItems } = setup()
    const result = await service.act(
      'org-1',
      'a1',
      { userId: 'u1', roleKeys: ['teacher'] },
      'approve',
      'ok',
    )
    expect(result).toMatchObject({ status: 'approved', actor: 'u1', decidedBy: 'u1' })
    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'approve', actorId: 'u1' }),
    )
    expect(workItems.close).toHaveBeenCalledWith('org-1', 'approval', approval.id)
  })

  it('非合法审批人 → 403', async () => {
    const { service } = setup()
    await expect(
      service.act('org-1', 'a1', { userId: 'u2', roleKeys: ['student'] }, 'approve'),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('已决策步骤 → 409', async () => {
    const { service } = setup({
      approval: { id: 'a1', organizationId: 'org-1', role: 'teacher', status: 'approved' },
    })
    await expect(
      service.act('org-1', 'a1', { userId: 'u1', roleKeys: ['teacher'] }, 'approve'),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('reject/request-changes 都写 rejected 与对应事件', async () => {
    const { service, events } = setup()
    await service.act('org-1', 'a1', { userId: 'u1', roleKeys: ['teacher'] }, 'reject')
    expect(events.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'reject' }),
    )
  })
  it('resubmit：基于最新轮次创建 round+1 pending，写事件/工作项', async () => {
    const latest = [
      {
        id: 'a1',
        organizationId: 'org-1',
        blueprintId: 'bp-1',
        blueprintVersion: '1.0.0',
        entity: 'Student',
        recordId: 'r1',
        ruleId: 'rule-1',
        round: 1,
        stepIndex: 0,
        role: 'teacher',
        kind: 'human',
        selector: null,
        assignee: null,
        checkProvider: null,
        dueAt: null,
        status: 'rejected',
      },
    ]
    const approvals = {
      findOne: jest.fn(async () => latest[0]),
      find: jest.fn(async () => latest),
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => ({ id: 'a2', ...row })),
    }
    const events = { create: jest.fn((row) => ({ id: 'e1', ...row })), save: jest.fn(async (row) => row) }
    const workItems = { project: jest.fn(async (row) => row) }
    const service = new ReviewDecisionService(
      approvals as never,
      events as never,
      { create: jest.fn(), save: jest.fn() } as never,
      workItems as never,
    )
    const created = await service.resubmit(
      'org-1',
      'a1',
      { userId: 'u1', roleKeys: ['teacher'] },
      'fixed',
    )
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ round: 2, status: 'pending' })
    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'resubmit', payload: expect.objectContaining({ toRound: 2 }) }),
    )
    expect(workItems.project).toHaveBeenCalled()
  })

  it('resubmit：当前轮次仍有 pending → 409', async () => {
    const pending = [{ id: 'a1', round: 1, status: 'pending', organizationId: 'org-1', recordId: 'r1', ruleId: 'rule-1', role: 'teacher' }]
    const service = new ReviewDecisionService(
      { findOne: jest.fn(async () => pending[0]), find: jest.fn(async () => pending) } as never,
      { create: jest.fn(), save: jest.fn() } as never,
      { create: jest.fn(), save: jest.fn() } as never,
      { project: jest.fn() } as never,
    )
    await expect(
      service.resubmit('org-1', 'a1', { userId: 'u1', roleKeys: ['teacher'] }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

})
