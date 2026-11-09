import { Injectable } from '@nestjs/common'
import { DataSource, EntityManager } from 'typeorm'
import type { JobBackoff, JobStatus } from './job-state'
import { clampJobProgress } from './job-state'
import type { JobRecord } from './job-types'

export interface EnqueueJobInput {
  organizationId: string
  appInstallationId?: string | null
  type: string
  typeVersion?: number
  payload: Record<string, unknown>
  priority?: number
  idempotencyKey?: string | null
  maxAttempts?: number
  runAt?: Date
  callbackUrl?: string | null
  callbackSecretRef?: string | null
  createdBy?: string | null
}

export interface JobListFilters {
  status?: JobStatus
  type?: string
  from?: Date
  to?: Date
  page?: number
  pageSize?: number
}

export interface EnqueuedJob {
  job: JobRecord
  created: boolean
}

const JSON_COLUMNS = new Set(['payload', 'result', 'error'])

function asJson(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return JSON.stringify(value)
}

/**
 * TypeORM 的 Postgres driver 对 `UPDATE/DELETE ... RETURNING` 可能返回
 * `[rows, affectedCount]` 而不是 `rows`。统一取出 rows，避免调用方拿到数组套数组。
 */
function returningRows<T>(result: unknown): T[] {
  if (
    Array.isArray(result) &&
    result.length === 2 &&
    Array.isArray(result[0]) &&
    typeof result[1] === 'number'
  ) {
    return result[0] as T[]
  }
  return result as T[]
}

/**
 * PostgreSQL 任务队列。
 *
 * 真源是 `jobs`；worker 用 `FOR UPDATE SKIP LOCKED` 领取，Redis 只做唤醒。
 * 所有查询都显式带 `organizationId`（除 worker 领取），RLS 仍是最后边界。
 */
@Injectable()
export class JobQueue {
  constructor(private readonly dataSource: DataSource) {}

  async enqueue(input: EnqueueJobInput, manager?: EntityManager): Promise<EnqueuedJob> {
    const runner = manager ?? this.dataSource
    const params = [
      input.organizationId,
      input.appInstallationId ?? null,
      input.type,
      input.typeVersion ?? 1,
      'queued',
      input.priority ?? 0,
      asJson(input.payload),
      input.idempotencyKey ?? null,
      input.maxAttempts ?? 3,
      input.runAt ?? new Date(),
      input.callbackUrl ?? null,
      input.callbackSecretRef ?? null,
      input.createdBy ?? null,
    ]
    const rows = returningRows<JobRecord>(await runner.query(
      `INSERT INTO public.jobs
         ("organizationId", "appInstallationId", type, "typeVersion", status,
          priority, payload, "idempotencyKey", "maxAttempts", "runAt",
          "callbackUrl", "callbackSecretRef", "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, now(), now())
       ON CONFLICT ("organizationId", type, "idempotencyKey") DO NOTHING
       RETURNING *`,
      params,
    ))

    if (rows.length > 0) return { job: rows[0], created: true }

    // 幂等命中：返回已存在任务，不重复执行。
    if (input.idempotencyKey) {
      const existing = (await runner.query(
        `SELECT * FROM public.jobs
          WHERE "organizationId" = $1 AND type = $2 AND "idempotencyKey" = $3
          LIMIT 1`,
        [input.organizationId, input.type, input.idempotencyKey],
      )) as JobRecord[]
      if (existing.length > 0) return { job: existing[0], created: false }
    }
    throw new Error('任务入队失败：既没有插入也没有命中幂等键')
  }

  async get(organizationId: string, id: string): Promise<JobRecord | null> {
    const rows = (await this.dataSource.query(
      `SELECT * FROM public.jobs WHERE id = $1 AND "organizationId" = $2 LIMIT 1`,
      [id, organizationId],
    )) as JobRecord[]
    return rows[0] ?? null
  }

  async list(
    organizationId: string,
    filters: JobListFilters = {},
  ): Promise<{ items: JobRecord[]; total: number }> {
    const params: unknown[] = [organizationId]
    const clauses = ['"organizationId" = $1']
    if (filters.status) {
      params.push(filters.status)
      clauses.push(`status = $${params.length}`)
    }
    if (filters.type) {
      params.push(filters.type)
      clauses.push(`type = $${params.length}`)
    }
    if (filters.from) {
      params.push(filters.from)
      clauses.push(`"createdAt" >= $${params.length}`)
    }
    if (filters.to) {
      params.push(filters.to)
      clauses.push(`"createdAt" <= $${params.length}`)
    }
    const page = Math.max(1, Math.floor(filters.page ?? 1))
    const pageSize = Math.max(1, Math.min(100, Math.floor(filters.pageSize ?? 20)))
    const where = clauses.join(' AND ')
    const countRows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM public.jobs WHERE ${where}`,
      params,
    )) as Array<{ total: number }>
    const queryParams = [...params, pageSize, (page - 1) * pageSize]
    const items = (await this.dataSource.query(
      `SELECT * FROM public.jobs WHERE ${where}
        ORDER BY "createdAt" DESC
        LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams,
    )) as JobRecord[]
    return { items, total: countRows[0]?.total ?? 0 }
  }

  async events(
    organizationId: string,
    jobId: string,
    afterSeq = 0,
  ): Promise<Array<Record<string, unknown>>> {
    return (await this.dataSource.query(
      `SELECT e.* FROM public.job_events e
        INNER JOIN public.jobs j ON j.id = e."jobId"
        WHERE e."jobId" = $1 AND j."organizationId" = $2 AND e.seq > $3
        ORDER BY e.seq ASC`,
      [jobId, organizationId, afterSeq],
    )) as Array<Record<string, unknown>>
  }

  /** 回收 lease 过期任务：请求取消的进 cancelled，否则重新 queued。 */
  async reclaimExpired(): Promise<string[]> {
    const rows = returningRows<{ id: string }>(await this.dataSource.query(
      `UPDATE public.jobs
          SET status = CASE WHEN "cancelRequested" THEN 'cancelled' ELSE 'queued' END,
              "workerId" = NULL,
              "leaseUntil" = NULL,
              "updatedAt" = now(),
              "finishedAt" = CASE WHEN "cancelRequested" THEN now() ELSE NULL END
        WHERE status = 'running'
          AND "leaseUntil" IS NOT NULL
          AND "leaseUntil" < now()
        RETURNING id`,
    ))
    return rows.map((row) => row.id)
  }

  /**
   * 领取一个任务。`typeConcurrency` 用于跨 worker 的按类型并发上限；
   * 未列出的类型按 1 处理。
   */
  async claim(
    workerId: string,
    leaseMs: number,
    typeConcurrency: Record<string, number> = {},
  ): Promise<JobRecord | null> {
    const params: unknown[] = [workerId, leaseMs]
    const entries = Object.entries(typeConcurrency).filter(([, limit]) => limit > 0)
    let concurrencyClause = ''
    if (entries.length > 0) {
      const cases: string[] = []
      for (const [type, limit] of entries) {
        params.push(type)
        const typeParam = `$${params.length}`
        params.push(Math.floor(limit))
        const limitParam = `$${params.length}`
        cases.push(`WHEN ${typeParam} THEN ${limitParam}`)
      }
      concurrencyClause = `AND (
        SELECT COUNT(*) FROM public.jobs r
        WHERE r.type = jj.type AND r.status = 'running'
      ) < CASE jj.type ${cases.join(' ')} ELSE 1 END`
    }

    const rows = returningRows<JobRecord>(await this.dataSource.query(
      `UPDATE public.jobs j
          SET status = 'running',
              "startedAt" = now(),
              "leaseUntil" = now() + ($2 * interval '1 millisecond'),
              "workerId" = $1,
              attempts = attempts + 1,
              "updatedAt" = now()
        WHERE j.id = (
          SELECT jj.id FROM public.jobs jj
           WHERE jj.status = 'queued'
             AND jj."runAt" <= now()
             ${concurrencyClause}
           ORDER BY jj.priority DESC, jj."runAt" ASC, jj."createdAt" ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1
        )
        RETURNING j.*`,
      params,
    ))
    return rows[0] ?? null
  }

  async heartbeat(jobId: string, workerId: string, leaseMs: number): Promise<boolean> {
    const rows = returningRows<{ id: string }>(await this.dataSource.query(
      `UPDATE public.jobs
          SET "leaseUntil" = now() + ($3 * interval '1 millisecond'),
              "updatedAt" = now()
        WHERE id = $1 AND "workerId" = $2 AND status = 'running'
        RETURNING id`,
      [jobId, workerId, leaseMs],
    ))
    return rows.length > 0
  }

  async isCancelRequested(jobId: string): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `SELECT "cancelRequested" FROM public.jobs WHERE id = $1 LIMIT 1`,
      [jobId],
    )) as Array<{ cancelRequested: boolean }>
    return rows[0]?.cancelRequested === true
  }

  async progress(jobId: string, progress: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE public.jobs
          SET progress = $2, "updatedAt" = now()
        WHERE id = $1 AND status = 'running'`,
      [jobId, clampJobProgress(progress)],
    )
  }

  async complete(
    jobId: string,
    workerId: string,
    result: Record<string, unknown> | null,
  ): Promise<JobRecord | null> {
    const rows = returningRows<JobRecord>(await this.dataSource.query(
      `UPDATE public.jobs
          SET status = 'succeeded',
              progress = 100,
              result = $3::jsonb,
              error = NULL,
              "finishedAt" = now(),
              "leaseUntil" = NULL,
              "workerId" = NULL,
              "updatedAt" = now()
        WHERE id = $1 AND "workerId" = $2 AND status = 'running'
        RETURNING *`,
      [jobId, workerId, asJson(result)],
    ))
    return rows[0] ?? null
  }

  async fail(
    jobId: string,
    workerId: string,
    error: Record<string, unknown>,
    next?: { status: 'queued' | 'dead'; runAt?: Date },
  ): Promise<JobRecord | null> {
    const status = next?.status ?? 'dead'
    const rows = returningRows<JobRecord>(await this.dataSource.query(
      `UPDATE public.jobs
          SET status = $3::varchar,
              error = $4::jsonb,
              "runAt" = COALESCE($5, "runAt"),
              "finishedAt" = CASE WHEN $3::text = 'dead' THEN now() ELSE NULL END,
              "leaseUntil" = NULL,
              "workerId" = NULL,
              "updatedAt" = now()
        WHERE id = $1 AND "workerId" = $2 AND status = 'running'
        RETURNING *`,
      [jobId, workerId, status, asJson(error), next?.runAt ?? null],
    ))
    return rows[0] ?? null
  }

  async cancel(
    organizationId: string,
    jobId: string,
  ): Promise<{ job: JobRecord; cancelledImmediately: boolean } | null> {
    const rows = returningRows<JobRecord>(await this.dataSource.query(
      `UPDATE public.jobs
          SET "cancelRequested" = true,
              status = CASE
                WHEN status IN ('queued', 'waiting') THEN 'cancelled'
                ELSE status
              END,
              "finishedAt" = CASE
                WHEN status IN ('queued', 'waiting') THEN now()
                ELSE "finishedAt"
              END,
              "updatedAt" = now()
        WHERE id = $1 AND "organizationId" = $2
          AND status IN ('queued', 'running', 'waiting')
        RETURNING *`,
      [jobId, organizationId],
    ))
    if (rows.length === 0) return null
    return { job: rows[0], cancelledImmediately: rows[0].status === 'cancelled' }
  }

  async cancelRunning(jobId: string, workerId: string): Promise<JobRecord | null> {
    const rows = returningRows<JobRecord>(await this.dataSource.query(
      `UPDATE public.jobs
          SET status = 'cancelled',
              "finishedAt" = now(),
              "leaseUntil" = NULL,
              "workerId" = NULL,
              "updatedAt" = now()
        WHERE id = $1 AND "workerId" = $2 AND status = 'running'
        RETURNING *`,
      [jobId, workerId],
    ))
    return rows[0] ?? null
  }

  async retryDead(organizationId: string, jobId: string): Promise<JobRecord | null> {
    const rows = returningRows<JobRecord>(await this.dataSource.query(
      `UPDATE public.jobs
          SET status = 'queued',
              attempts = 0,
              error = NULL,
              result = NULL,
              progress = 0,
              "cancelRequested" = false,
              "runAt" = now(),
              "finishedAt" = NULL,
              "leaseUntil" = NULL,
              "workerId" = NULL,
              "updatedAt" = now()
        WHERE id = $1 AND "organizationId" = $2 AND status = 'dead'
        RETURNING *`,
      [jobId, organizationId],
    ))
    return rows[0] ?? null
  }

  async appendEvent(
    jobId: string,
    type: 'progress' | 'stage' | 'log' | 'callback' | 'error' | string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.dataSource.query(
          `INSERT INTO public.job_events ("jobId", seq, type, payload, "createdAt", "updatedAt")
           SELECT $1, COALESCE(MAX(seq), 0) + 1, $2, $3::jsonb, now(), now()
             FROM public.job_events WHERE "jobId" = $1`,
          [jobId, type, asJson(payload)],
        )
        return
      } catch (error) {
        if ((error as { code?: string }).code !== '23505' || attempt === 2) throw error
      }
    }
  }

  async recordAttempt(input: {
    jobId: string
    attempt: number
    status: 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timeout'
    startedAt: Date
    finishedAt?: Date | null
    error?: Record<string, unknown> | null
  }): Promise<void> {
    const durationMs = input.finishedAt
      ? Math.max(0, input.finishedAt.getTime() - input.startedAt.getTime())
      : null
    await this.dataSource.query(
      `INSERT INTO public.job_attempts
         ("jobId", attempt, status, error, "startedAt", "finishedAt", "durationMs", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, now(), now())
       ON CONFLICT ("jobId", attempt) DO UPDATE SET
         status = EXCLUDED.status,
         error = EXCLUDED.error,
         "finishedAt" = EXCLUDED."finishedAt",
         "durationMs" = EXCLUDED."durationMs",
         "updatedAt" = now()`,
      [
        input.jobId,
        input.attempt,
        input.status,
        asJson(input.error ?? null),
        input.startedAt,
        input.finishedAt ?? null,
        durationMs,
      ],
    )
  }

  async updateCallback(
    jobId: string,
    callbackStatus: string,
    attempts: number,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE public.jobs
          SET "callbackStatus" = $2,
              "callbackAttempts" = $3,
              "updatedAt" = now()
        WHERE id = $1`,
      [jobId, callbackStatus, attempts],
    )
    await this.appendEvent(jobId, 'callback', {
      status: callbackStatus,
      attempts,
      ...payload,
    })
  }
}

export type { JobBackoff }
