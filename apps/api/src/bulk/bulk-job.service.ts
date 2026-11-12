import { Injectable, OnModuleInit } from '@nestjs/common'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { BulkService } from './bulk.service'

@Injectable()
export class BulkJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly bulk: BulkService,
  ) {}

  onModuleInit(): void {
    if (!this.registry.has('bulk.import')) {
      this.registry.register({
        type: 'bulk.import',
        typeVersion: 1,
        timeoutMs: 20 * 60_000,
        maxAttempts: 1,
        backoff: { kind: 'fixed', baseMs: 5_000, maxMs: 5_000 },
        concurrency: 2,
        payloadSchema: {
          type: 'object',
          required: ['runId'],
          properties: { runId: { type: 'string', minLength: 1 } },
          additionalProperties: false,
        },
        handler: async (ctx, payload) => {
          const actor = await this.bulk.importJobActor(ctx.organizationId, String(payload.runId))
          const run = await this.bulk.processImportRun(
            String(payload.runId),
            ctx.organizationId,
            actor,
            async (progress, stage, extra) => {
              if (stage) await ctx.stage(stage, extra)
              await ctx.progress(progress, extra)
            },
            () => ctx.isCancelled(),
          )
          return {
            result: {
              runId: run.id,
              status: run.status,
              rows: run.rowCount,
              success: run.successCount,
              failed: run.failureCount,
            },
          }
        },
      })
    }
    if (!this.registry.has('bulk.export')) {
      this.registry.register({
        type: 'bulk.export',
        typeVersion: 1,
        timeoutMs: 20 * 60_000,
        maxAttempts: 1,
        backoff: { kind: 'fixed', baseMs: 5_000, maxMs: 5_000 },
        concurrency: 2,
        payloadSchema: {
          type: 'object',
          required: ['runId'],
          properties: { runId: { type: 'string', minLength: 1 } },
          additionalProperties: false,
        },
        handler: async (ctx, payload) => {
          const actor = await this.bulk.exportJobActor(ctx.organizationId, String(payload.runId))
          const run = await this.bulk.processExportRun(
            String(payload.runId),
            ctx.organizationId,
            actor,
            async (progress, stage, extra) => {
              if (stage) await ctx.stage(stage, extra)
              await ctx.progress(progress, extra)
            },
            () => ctx.isCancelled(),
          )
          return {
            result: {
              runId: run.id,
              status: run.status,
              format: run.format,
              rows: run.rowCount,
              assetId: run.assetId,
            },
          }
        },
      })
    }
  }
}
