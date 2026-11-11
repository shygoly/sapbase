import { Injectable, OnModuleInit } from '@nestjs/common'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { AssetProcessingService } from '@sap/platform-core/assets/asset-processing.service'

/** 媒体扫描/转码任务：复用 asset-pipeline 的处理器与状态机。 */
@Injectable()
export class AssetJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly processing: AssetProcessingService,
  ) {}

  onModuleInit(): void {
    if (this.registry.has('asset.process')) return
    this.registry.register({
      type: 'asset.process',
      typeVersion: 1,
      timeoutMs: 5 * 60_000,
      maxAttempts: 3,
      backoff: { kind: 'exponential', baseMs: 2_000, maxMs: 60_000 },
      concurrency: 2,
      payloadSchema: {
        type: 'object',
        required: ['assetId'],
        properties: { assetId: { type: 'string', minLength: 1 } },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => {
        await ctx.stage('processing', { assetId: payload.assetId })
        const result = await this.processing.process(
          ctx.organizationId,
          String(payload.assetId),
        )
        await ctx.progress(100)
        return { result }
      },
    })
  }
}
