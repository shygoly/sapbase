import { Injectable, OnModuleInit } from '@nestjs/common'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { RecordLifecycleService } from './record-lifecycle.service'

/** 大子树克隆走异步任务；小操作仍可同步。 */
@Injectable()
export class RecordLifecycleJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly lifecycle: RecordLifecycleService,
  ) {}

  onModuleInit(): void {
    if (this.registry.has('record.clone')) return
    this.registry.register({
      type: 'record.clone',
      typeVersion: 1,
      timeoutMs: 10 * 60_000,
      maxAttempts: 1,
      backoff: { kind: 'fixed', baseMs: 5_000, maxMs: 5_000 },
      concurrency: 1,
      payloadSchema: {
        type: 'object',
        required: ['packageId', 'entity', 'recordId', 'actorId'],
        properties: {
          packageId: { type: 'string' },
          entity: { type: 'string' },
          recordId: { type: 'string' },
          actorId: { type: 'string' },
          idempotencyKey: { type: 'string' },
          uniqueStrategy: { enum: ['fail', 'suffix', 'placeholder'] },
          dataOverride: { type: 'object' },
        },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => {
        await ctx.stage('cloning', { recordId: payload.recordId })
        const result = (await this.lifecycle.clone({
          packageId: String(payload.packageId),
          entity: String(payload.entity),
          recordId: String(payload.recordId),
          organizationId: ctx.organizationId,
          actor: { id: String(payload.actorId), permissions: ['record:clone'] },
          idempotencyKey: payload.idempotencyKey
            ? String(payload.idempotencyKey)
            : `job:${ctx.jobId}`,
          uniqueStrategy: payload.uniqueStrategy as never,
          dataOverride: payload.dataOverride as never,
        })) as any
        await ctx.progress(100, { cloned: result?.cloned ?? 0 })
        return { result }
      },
    })
  }
}
