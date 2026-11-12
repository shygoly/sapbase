import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'
import { BusinessAppsService } from './business-apps.service'

/**
 * 应用升级长任务（4.8）。
 *
 * 升级会重新装载 Blueprint、做数据兼容检查并给全部记录打快照，
 * 大应用不应占用一个 HTTP 请求。job 只携带安装 id/目标包 id；
 * 操作人来自 job.createdBy（可信 JWT），不从 payload 读取。
 */
@Injectable()
export class BusinessAppsJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly jobs: JobsService,
    private readonly apps: BusinessAppsService,
  ) {}

  onModuleInit(): void {
    if (this.registry.has('app.upgrade')) return
    this.registry.register({
      type: 'app.upgrade',
      typeVersion: 1,
      timeoutMs: 10 * 60_000,
      maxAttempts: 1,
      backoff: { kind: 'fixed', baseMs: 5_000, maxMs: 5_000 },
      concurrency: 1,
      payloadSchema: {
        type: 'object',
        required: ['installationId', 'packageId'],
        properties: {
          installationId: { type: 'string', minLength: 1 },
          packageId: { type: 'string', minLength: 1, maxLength: 128 },
        },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => {
        const job = await this.jobs.get(ctx.organizationId, ctx.jobId)
        if (!job.createdBy) {
          throw new BadRequestException('应用升级任务缺少可信创建人')
        }
        await ctx.stage('app-upgrading', {
          installationId: payload.installationId,
          packageId: payload.packageId,
        })
        const installation = await this.apps.upgrade({
          id: String(payload.installationId),
          organizationId: ctx.organizationId,
          packageId: String(payload.packageId),
          userId: job.createdBy,
          actor: job.createdBy,
        })
        await ctx.progress(100, {
          installationId: installation.id,
          blueprintVersion: installation.blueprintVersion,
        })
        return {
          result: {
            installationId: installation.id,
            appKey: installation.appKey,
            blueprintVersion: installation.blueprintVersion,
            status: installation.status,
          },
        }
      },
    })
  }
}
