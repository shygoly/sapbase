import {
  BadRequestException,
  HttpException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { assertSafeCallbackUrl } from './job-callback'
import { JobCallbackService } from './job-callback'
import type { JobCallbackOptions } from './job-callback'
import { JobQueue } from './job-queue'
import type { JobListFilters } from './job-queue'
import { JobTypeRegistry } from './job-types'
import { JobWakeupService } from './job-wakeup'
import type { JobRecord } from './job-types'

export interface CreateJobInput {
  type: string
  typeVersion?: number
  payload: Record<string, unknown>
  idempotencyKey?: string | null
  callbackUrl?: string | null
  callbackSecretRef?: string | null
  priority?: number
  appInstallationId?: string | null
}

export interface JobActor {
  userId: string
  permissions: readonly string[]
}

const MAX_PAYLOAD_BYTES = 64 * 1024
const MAX_QUEUED_PER_ORG = 1_000

/**
 * 外部任务门面：创建/查询/取消/重试/事件/回调重放。
 *
 * 组织与应用上下文只从可信身份取；body 里的 organizationId 一律忽略。
 */
@Injectable()
export class JobsService {
  private readonly rateWindow = new Map<string, number[]>()

  constructor(
    private readonly queue: JobQueue,
    private readonly registry: JobTypeRegistry,
    private readonly callbacks: JobCallbackService,
    @Optional() private readonly wakeup?: JobWakeupService,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  async create(
    organizationId: string,
    actor: JobActor,
    input: CreateJobInput,
  ): Promise<{ job: JobRecord; created: boolean }> {
    if (!organizationId) {
      throw new BadRequestException('缺少组织上下文')
    }
    this.assertRateLimit(organizationId)
    this.assertCreatePermission(actor, input.type)
    const typeVersion = input.typeVersion ?? 1
    this.registry.get(input.type, typeVersion)

    const payloadBytes = Buffer.byteLength(JSON.stringify(input.payload ?? {}), 'utf8')
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      throw new BadRequestException(
        `payload 过大：${payloadBytes} bytes（上限 ${MAX_PAYLOAD_BYTES}）`,
      )
    }
    const validation = this.registry.validatePayload(input.type, typeVersion, input.payload)
    if (!validation.valid) {
      throw new BadRequestException(
        `任务 payload 不合法：${validation.errors.join('; ')}`,
      )
    }
    if (input.callbackUrl) {
      try {
        assertSafeCallbackUrl(input.callbackUrl, this.callbackOptions())
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : String(error),
        )
      }
    }

    const definition = this.registry.get(input.type, typeVersion)
    const existing = await this.queue.list(organizationId, {
      status: 'queued',
      pageSize: 1,
    })
    if (existing.total >= MAX_QUEUED_PER_ORG && !input.idempotencyKey) {
      throw new ConflictException(`组织排队任务已达上限 ${MAX_QUEUED_PER_ORG}`)
    }

    const { job, created } = await this.queue.enqueue({
      organizationId,
      appInstallationId: input.appInstallationId ?? null,
      type: input.type,
      typeVersion,
      payload: input.payload ?? {},
      priority: input.priority ?? definition.priority ?? 0,
      idempotencyKey: input.idempotencyKey ?? null,
      maxAttempts: definition.maxAttempts ?? 3,
      callbackUrl: input.callbackUrl ?? null,
      callbackSecretRef: input.callbackSecretRef ?? null,
      createdBy: actor.userId ?? null,
    })

    await this.wakeup?.publish(job.id)
    await this.audit(organizationId, 'job.create', job.id, {
      type: job.type,
      created,
      idempotencyKey: job.idempotencyKey,
      actor: actor.userId,
    })
    return { job, created }
  }

  async get(organizationId: string, id: string): Promise<JobRecord> {
    const job = await this.queue.get(organizationId, id)
    if (!job) throw new NotFoundException('Job not found')
    return job
  }

  async list(organizationId: string, filters: JobListFilters) {
    return this.queue.list(organizationId, filters)
  }

  async cancel(
    organizationId: string,
    id: string,
    actor: JobActor,
  ): Promise<JobRecord> {
    const result = await this.queue.cancel(organizationId, id)
    if (!result) throw new NotFoundException('Job not found or not cancellable')
    await this.audit(organizationId, 'job.cancel', id, {
      actor: actor.userId,
      cancelledImmediately: result.cancelledImmediately,
    })
    return result.job
  }

  async retryDead(
    organizationId: string,
    id: string,
    actor: JobActor,
  ): Promise<JobRecord> {
    const job = await this.queue.retryDead(organizationId, id)
    if (!job) throw new ConflictException('Job is not in dead state')
    await this.audit(organizationId, 'job.retry', id, { actor: actor.userId })
    return job
  }

  async stats(organizationId: string) {
    return this.queue.stats(organizationId)
  }

  async events(organizationId: string, id: string, afterSeq = 0) {
    await this.get(organizationId, id)
    return this.queue.events(organizationId, id, afterSeq)
  }

  async replayCallback(
    organizationId: string,
    id: string,
    actor: JobActor,
    options: JobCallbackOptions = {},
  ) {
    const job = await this.get(organizationId, id)
    if (!job.callbackUrl) throw new ConflictException('Job has no callback URL')
    const result = await this.callbacks.replay(job, {
      ...this.callbackOptions(),
      ...options,
    })
    await this.audit(organizationId, 'job.callback.replay', id, {
      actor: actor.userId,
      outcome: result.outcome,
      attempts: result.attempts,
    })
    return result
  }

  private assertRateLimit(organizationId: string): void {
    const limit = Number(process.env.JOBS_RATE_LIMIT_PER_MINUTE ?? 120)
    if (!Number.isFinite(limit) || limit <= 0) return
    const now = Date.now()
    const windowStart = now - 60_000
    const recent = (this.rateWindow.get(organizationId) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    )
    if (recent.length >= limit) {
      throw new HttpException(
        { statusCode: 429, message: `任务创建速率超限（${limit}/分钟）` },
        429,
      )
    }
    recent.push(now)
    this.rateWindow.set(organizationId, recent)
  }

  private assertCreatePermission(actor: JobActor, type: string): void {
    const granted = new Set(actor.permissions ?? [])
    if (granted.has('jobs:manage') || granted.has(`job:${type}:create`)) return
    throw new ForbiddenException(
      `缺少任务创建权限：job:${type}:create（或 jobs:manage）`,
    )
  }

  private callbackOptions(): JobCallbackOptions {
    const allowlist = process.env.JOB_CALLBACK_ALLOWLIST
      ? process.env.JOB_CALLBACK_ALLOWLIST.split(',')
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean)
      : undefined
    return {
      allowHttp: process.env.JOB_CALLBACK_ALLOW_HTTP === 'true',
      allowlist,
    }
  }

  private async audit(
    organizationId: string,
    action: string,
    jobId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLogs?.create({
      action,
      resource: 'job',
      resourceId: jobId,
      actor: 'jobs-service',
      status: 'success',
      organizationId,
      metadata,
    })
  }
}
