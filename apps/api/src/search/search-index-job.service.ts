import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { JobTypeRegistry, type JobTypeDefinition } from '@sap/platform-core/jobs/job-types'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'
import { SearchService } from './search.service'

export const SEARCH_INDEX_JOB = 'search.index'
export const SEARCH_REINDEX_JOB = 'search.reindex'

/**
 * 搜索索引任务类型：事件驱动单条 upsert + 全量重建。
 * handler 可重入；重复执行只会重写 hash 变化的文档。
 */
@Injectable()
export class SearchIndexJobService implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexJobService.name)

  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly search: SearchService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit(): void {
    if (!this.registry.has(SEARCH_INDEX_JOB)) {
      this.registry.register(this.indexDefinition())
    }
    if (!this.registry.has(SEARCH_REINDEX_JOB)) {
      this.registry.register(this.reindexDefinition())
    }
  }

  /** 事件订阅者调用：worker 开启时入队，否则同步执行（本地开发不丢索引）。 */
  async enqueueIndex(
    organizationId: string,
    resourceKey: string,
    resourceId: string,
  ): Promise<void> {
    if (process.env.JOBS_WORKER_ENABLED === 'true') {
      await this.jobs.create(
        organizationId,
        { userId: 'system', permissions: ['system:manage'] },
        {
          type: SEARCH_INDEX_JOB,
          payload: { resourceKey, resourceId },
          idempotencyKey: `search:${resourceKey}:${resourceId}`,
        },
      )
      return
    }
    await this.search.indexResource(organizationId, resourceKey as never, resourceId)
  }

  private indexDefinition(): JobTypeDefinition {
    return {
      type: SEARCH_INDEX_JOB,
      typeVersion: 1,
      timeoutMs: 30_000,
      maxAttempts: 3,
      backoff: { kind: 'exponential', baseMs: 2_000, maxMs: 30_000 },
      concurrency: 2,
      payloadSchema: {
        type: 'object',
        required: ['resourceKey', 'resourceId'],
        properties: {
          resourceKey: {
            type: 'string',
            enum: ['announcement', 'asset', 'ai_module', 'agent_knowledge'],
          },
          resourceId: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => {
        await ctx.stage('indexing', payload)
        const result = await this.search.indexResource(
          ctx.organizationId,
          payload.resourceKey as never,
          String(payload.resourceId),
        )
        await ctx.progress(100)
        return { result }
      },
    }
  }

  private reindexDefinition(): JobTypeDefinition {
    return {
      type: SEARCH_REINDEX_JOB,
      typeVersion: 1,
      timeoutMs: 10 * 60_000,
      maxAttempts: 2,
      backoff: { kind: 'exponential', baseMs: 5_000, maxMs: 60_000 },
      concurrency: 1,
      payloadSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      handler: async (ctx) => {
        await ctx.stage('reindexing')
        const counts = await this.search.reindexAll(ctx.organizationId)
        await ctx.progress(100, counts)
        this.logger.log(`搜索重建完成 ${ctx.organizationId}: ${JSON.stringify(counts)}`)
        return { result: counts }
      },
    }
  }
}
