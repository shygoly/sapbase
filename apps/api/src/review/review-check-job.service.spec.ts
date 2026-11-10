import type { JobContext } from '@sap/platform-core/jobs/job-types'
import { ReviewCheckJobService } from './review-check-job.service'

function setup(approval: Record<string, unknown> | null) {
  const saved: any[] = []
  const events: any[] = []
  const approvals = {
    findOne: jest.fn(async () => approval),
    save: jest.fn(async (row) => {
      saved.push(row)
      return row
    }),
  }
  const reviewEvents = {
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => {
      events.push(row)
      return row
    }),
  }
  const registry = { has: jest.fn(() => true), register: jest.fn() }
  const checks = { run: jest.fn() }
  const service = new ReviewCheckJobService(
    registry as never,
    checks as never,
    approvals as never,
    reviewEvents as never,
  )
  const ctx = {
    jobId: 'job-1',
    organizationId: 'org-1',
  } as unknown as JobContext
  return { service, saved, events, approvals, reviewEvents, ctx }
}

const BASE_APPROVAL = {
  id: 'approval-1',
  organizationId: 'org-1',
  recordId: 'record-1',
  round: 1,
  stepIndex: 0,
  kind: 'check',
  status: 'pending',
  checkResult: null,
}

describe('ReviewCheckJobService', () => {
  it('pass 将 check 步骤置为 approved 并写检测证据', async () => {
    const approval = { ...BASE_APPROVAL }
    const { service, saved, events, ctx } = setup(approval)

    await service.record(
      ctx,
      { provider: 'safety', input: { text: 'ok' }, approvalId: 'approval-1', round: 1, stepIndex: 0 },
      { status: 'pass', evidence: { score: 0.01 } },
    )

    expect(saved[0]).toMatchObject({
      id: 'approval-1',
      status: 'approved',
      actor: 'system:review.check',
      checkResult: { provider: 'safety', status: 'pass', jobId: 'job-1' },
    })
    expect(events[0]).toMatchObject({ type: 'check', approvalId: 'approval-1' })
  })

  it('fail 将 check 步骤置为 rejected', async () => {
    const approval = { ...BASE_APPROVAL }
    const { service, saved, ctx } = setup(approval)
    await service.record(
      ctx,
      { provider: 'safety', input: {}, approvalId: 'approval-1' },
      { status: 'fail', evidence: { reason: 'blocked' } },
    )
    expect(saved[0]).toMatchObject({ status: 'rejected' })
  })

  it('warn 保持 pending，等待人工确认', async () => {
    const approval = { ...BASE_APPROVAL }
    const { service, saved, ctx } = setup(approval)
    await service.record(
      ctx,
      { provider: 'safety', input: {}, approvalId: 'approval-1' },
      { status: 'warn', evidence: { reason: 'manual' } },
    )
    expect(saved[0]).toMatchObject({ status: 'pending' })
  })

  it('human 步骤不被机器代批，只记录证据', async () => {
    const approval = { ...BASE_APPROVAL, kind: 'human' }
    const { service, saved, ctx } = setup(approval)
    await service.record(
      ctx,
      { provider: 'safety', input: {}, approvalId: 'approval-1' },
      { status: 'pass', evidence: {} },
    )
    expect(saved[0]).toMatchObject({ status: 'pending', checkResult: { status: 'pass' } })
  })

  it('轮次不匹配时不回写', async () => {
    const approval = { ...BASE_APPROVAL }
    const { service, saved, ctx } = setup(approval)
    await service.record(
      ctx,
      { provider: 'safety', input: {}, approvalId: 'approval-1', round: 2 },
      { status: 'pass', evidence: {} },
    )
    expect(saved).toHaveLength(0)
  })
})
