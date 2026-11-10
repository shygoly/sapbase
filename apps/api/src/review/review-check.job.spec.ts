import { createReviewCheckJobDefinition } from './review-check.job'
import { ReviewCheckRegistry, ReviewCheckService } from './review-check'
import type { JobContext } from '@sap/platform-core/jobs/job-types'

describe('review.check job definition', () => {
  it('注册形状 + handler 调用 check service 并返回结果', async () => {
    const registry = new ReviewCheckRegistry()
    registry.register({
      name: 'ok',
      check: jest.fn(async (_input: Record<string, unknown>) => ({ status: 'pass' as const, evidence: { x: 1 } })),
    })
    const definition = createReviewCheckJobDefinition(new ReviewCheckService(registry))
    expect(definition.type).toBe('review.check')
    expect(definition.maxAttempts).toBe(2)
    const ctx = {
      stage: jest.fn(async () => undefined),
      progress: jest.fn(async () => undefined),
    } as unknown as JobContext
    const result = await definition.handler(ctx, {
      provider: 'ok',
      input: { a: 1 },
    })
    expect(result).toEqual({ result: { status: 'pass', evidence: { x: 1 } } })
    expect(ctx.stage).toHaveBeenCalledWith('checking', { provider: 'ok' })
    expect(ctx.progress).toHaveBeenCalledWith(100)
  })

  it('有 writeback 时把结果回传', async () => {
    const registry = new ReviewCheckRegistry()
    registry.register({
      name: 'ok',
      check: async () => ({ status: 'warn' as const, evidence: { reason: 'manual' } }),
    })
    const writeback = { record: jest.fn(async () => undefined) }
    const definition = createReviewCheckJobDefinition(
      new ReviewCheckService(registry),
      writeback,
    )
    const ctx = {
      jobId: 'job-1',
      organizationId: 'org-1',
      stage: jest.fn(async () => undefined),
      progress: jest.fn(async () => undefined),
    } as unknown as JobContext

    await definition.handler(ctx, {
      provider: 'ok',
      input: { a: 1 },
      approvalId: 'approval-1',
      round: 1,
      stepIndex: 0,
    })

    expect(writeback.record).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ approvalId: 'approval-1' }),
      { status: 'warn', evidence: { reason: 'manual' } },
    )
  })
})
