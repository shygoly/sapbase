import type { JobContext, JobTypeDefinition } from '@sap/platform-core/jobs/job-types'
import type { ReviewCheckResult, ReviewCheckService } from './review-check'

export interface ReviewCheckJobPayload {
  provider: string
  input: Record<string, unknown>
  timeoutMs?: number
  approvalId?: string
  round?: number
  stepIndex?: number
}

export interface ReviewCheckWriteback {
  record(
    ctx: JobContext,
    payload: ReviewCheckJobPayload,
    result: ReviewCheckResult,
  ): Promise<void>
}

/**
 * `review.check` 任务类型：机器检测走 async-job 的统一队列/重试/事件。
 * handler 调用 ReviewCheckService；可选 writeback 把结果回写审批步骤与 review_events。
 */
export function createReviewCheckJobDefinition(
  checks: ReviewCheckService,
  writeback?: ReviewCheckWriteback,
): JobTypeDefinition {
  return {
    type: 'review.check',
    typeVersion: 1,
    timeoutMs: 60_000,
    maxAttempts: 2,
    backoff: { kind: 'exponential', baseMs: 2_000, maxMs: 30_000 },
    concurrency: 2,
    payloadSchema: {
      type: 'object',
      required: ['provider', 'input'],
      properties: {
        provider: { type: 'string', minLength: 1 },
        input: { type: 'object' },
        timeoutMs: { type: 'integer', minimum: 1 },
        approvalId: { type: 'string', minLength: 1 },
        round: { type: 'integer', minimum: 1 },
        stepIndex: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
    handler: async (ctx, rawPayload) => {
      const payload = rawPayload as unknown as ReviewCheckJobPayload
      await ctx.stage('checking', { provider: payload.provider })
      const result = await checks.run(payload.provider, payload.input, {
        timeoutMs: payload.timeoutMs,
      })
      await writeback?.record(ctx, payload, result)
      await ctx.progress(100)
      return { result }
    },
  }
}
