import { Injectable, OnModuleInit } from '@nestjs/common'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { IntegrationOutboundService } from './integration-outbound.service'
import { IntegrationDataSourceService } from './integration-data-source.service'

@Injectable()
export class IntegrationJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly outbound: IntegrationOutboundService,
    private readonly dataSources: IntegrationDataSourceService,
  ) {}

  onModuleInit(): void {
    if (!this.registry.has('integration.outbound')) {
      this.registry.register({
        type: 'integration.outbound',
        typeVersion: 1,
        timeoutMs: 2 * 60_000,
        maxAttempts: 5,
        backoff: { kind: 'exponential', baseMs: 2_000, maxMs: 60_000 },
        concurrency: 4,
        payloadSchema: {
          type: 'object',
          required: ['messageId'],
          properties: { messageId: { type: 'string', minLength: 1 } },
          additionalProperties: false,
        },
        handler: async (ctx, payload) => {
          await ctx.stage('delivering')
          const message = await this.outbound.send(
            ctx.organizationId,
            String(payload.messageId),
          )
          await ctx.progress(100)
          return {
            result: {
              messageId: message.id,
              status: message.status,
              attempts: message.attempts,
              responseStatus: message.responseStatus,
            },
          }
        },
      })
    }
    if (!this.registry.has('integration.sync')) {
      this.registry.register({
        type: 'integration.sync',
        typeVersion: 1,
        timeoutMs: 15 * 60_000,
        maxAttempts: 1,
        backoff: { kind: 'fixed', baseMs: 5_000, maxMs: 5_000 },
        concurrency: 1,
        payloadSchema: {
          type: 'object',
          required: ['runId'],
          properties: { runId: { type: 'string', minLength: 1 } },
          additionalProperties: false,
        },
        handler: async (ctx, payload) => {
          await ctx.stage('syncing')
          const run = await this.dataSources.processRun(
            ctx.organizationId,
            String(payload.runId),
          )
          await ctx.progress(100)
          return {
            result: {
              runId: run.id,
              status: run.status,
              rowsRead: run.rowsRead,
              rowsWritten: run.rowsWritten,
              rowsFailed: run.rowsFailed,
            },
          }
        },
      })
    }
  }
}
