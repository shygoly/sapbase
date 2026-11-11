import { Injectable, OnModuleInit } from '@nestjs/common'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { DocumentIntelligenceService } from './document-intelligence.service'

@Injectable()
export class DocumentIntelligenceJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly documents: DocumentIntelligenceService,
  ) {}

  onModuleInit(): void {
    if (this.registry.has('document.intelligence.parse')) return
    this.registry.register({
      type: 'document.intelligence.parse',
      typeVersion: 1,
      timeoutMs: 10 * 60_000,
      maxAttempts: 2,
      backoff: { kind: 'exponential', baseMs: 5_000, maxMs: 60_000 },
      concurrency: 2,
      payloadSchema: {
        type: 'object',
        required: ['runId'],
        properties: { runId: { type: 'string', minLength: 1 } },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => {
        const run = await this.documents.processRun(
          ctx.organizationId,
          String(payload.runId),
          async (stage, progress) => {
            await ctx.stage(stage)
            await ctx.progress(progress)
          },
        )
        return {
          result: {
            runId: run.id,
            status: run.status,
            pages: run.pageCount,
            parser: run.parser,
          },
        }
      },
    })
  }
}
