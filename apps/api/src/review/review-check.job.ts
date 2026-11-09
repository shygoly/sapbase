import type { JobTypeDefinition } from '@sap/platform-core/jobs/job-types'
import type { ReviewCheckService } from './review-check'

/**
 * `review.check` 任务类型：机器检测走 async-job 的统一队列/重试/事件。
 * handler 只调用 ReviewCheckService；审批状态落库由 ReviewCheckJobService 消费结果。
 */
export function createReviewCheckJobDefinition(
  checks: ReviewCheckService,
): JobTypeDefinition<{ provider: string; input: Record<string, unknown>; timeoutMs?: number }> {
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
      },
      additionalProperties: false,
    },
    handler: async (ctx, payload) => {
      await ctx.stage('checking', { provider: payload.provider })
      const result = await checks.run(payload.provider, payload.input, {
        timeoutMs: payload.timeoutMs,
      })
      await ctx.progress(100)
      return { result }
    },
  }
}
