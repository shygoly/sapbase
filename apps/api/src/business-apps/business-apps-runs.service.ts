import { Injectable, NotFoundException } from '@nestjs/common'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'

export interface StartUpgradeInput {
  organizationId: string
  installationId: string
  packageId: string
  userId: string
  idempotencyKey?: string | null
}

export interface UpgradeJobView {
  jobId: string
  installationId: string | null
  status: string
  progress: number
  result: Record<string, unknown> | null
  error: Record<string, unknown> | null
  createdAt: string | null
  startedAt: string | null
  finishedAt: string | null
}

/** 应用升级的异步 HTTP 门面：只入队并返回 jobId。 */
@Injectable()
export class BusinessAppsRunsService {
  constructor(private readonly jobs: JobsService) {}

  async startUpgrade(input: StartUpgradeInput) {
    const { job, created } = await this.jobs.create(
      input.organizationId,
      {
        userId: input.userId,
        // 专用入口只允许创建 app.upgrade；调用方已通过 system:manage。
        permissions: ['job:app.upgrade:create'],
      },
      {
        type: 'app.upgrade',
        payload: {
          installationId: input.installationId,
          packageId: input.packageId,
        },
        idempotencyKey: input.idempotencyKey ?? null,
      },
    )
    return {
      jobId: job.id,
      installationId:
        typeof job.payload?.installationId === 'string'
          ? job.payload.installationId
          : input.installationId,
      status: job.status,
      created,
    }
  }

  async getUpgrade(
    organizationId: string,
    jobId: string,
  ): Promise<UpgradeJobView> {
    const job = await this.jobs.get(organizationId, jobId)
    if (job.type !== 'app.upgrade') {
      throw new NotFoundException('应用升级任务不存在')
    }
    const payload = (job.result ?? null) as Record<string, unknown> | null
    return {
      jobId: job.id,
      installationId:
        typeof payload?.installationId === 'string'
          ? payload.installationId
          : typeof job.payload?.installationId === 'string'
            ? job.payload.installationId
            : null,
      status: job.status,
      progress: job.progress,
      result: payload,
      error: job.error,
      createdAt: asIso(job.createdAt),
      startedAt: asIso(job.startedAt),
      finishedAt: asIso(job.finishedAt),
    }
  }
}

function asIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}
