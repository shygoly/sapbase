import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash } from 'node:crypto'
import { Client } from 'pg'
import { Repository } from 'typeorm'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'
import { BulkService } from '../bulk/bulk.service'
import {
  DataSource,
  DataSyncJob,
  DataSyncRun,
  type SyncMode,
} from './integrations.entities'
import type { IntegrationActor } from './integration-connector.service'
import { assertSafeDbHost, resolveSecret } from './integrations.security'

const QUERY_TEMPLATES: Record<
  string,
  {
    sql: string
    cursor: boolean
    params: (watermark: string | null, batchSize: number) => unknown[]
  }
> = {
  students_incremental: {
    sql: `SELECT student_no AS "studentNo", name, class_name AS "className", updated_at AS "updatedAt"
          FROM students WHERE updated_at > $1 ORDER BY updated_at ASC LIMIT $2`,
    cursor: true,
    params: (watermark, batchSize) => [watermark ?? '1970-01-01T00:00:00Z', batchSize],
  },
  students_count: {
    sql: `SELECT count(*)::int AS count FROM students WHERE updated_at > $1`,
    cursor: true,
    params: (watermark) => [watermark ?? '1970-01-01T00:00:00Z'],
  },
  departments_incremental: {
    sql: `SELECT name, description, status, "updatedAt" AS "updatedAt"
          FROM departments WHERE "updatedAt" > $1 ORDER BY "updatedAt" ASC LIMIT $2`,
    cursor: true,
    params: (watermark, batchSize) => [watermark ?? '1970-01-01T00:00:00Z', batchSize],
  },
}

export interface DataSourceInput {
  key?: string
  name?: string
  dbType?: 'postgres' | 'mysql' | 'mssql' | 'oracle'
  host?: string
  port?: number
  database?: string
  ssl?: boolean
  secretRef?: string
  allowlist?: string[]
}

export interface SyncJobInput {
  key?: string
  name?: string
  dataSourceId?: string
  queryTemplate?: string
  queryParams?: Record<string, unknown>
  fieldMapping?: Record<string, unknown>
  targetResourceKey?: string
  mode?: SyncMode
  cursorField?: string | null
  batchSize?: number
  schedule?: string | null
}

function sanitizeSource(row: DataSource) {
  return { ...row, secretRef: `secret:${row.secretRef}` }
}

@Injectable()
export class IntegrationDataSourceService {
  constructor(
    @InjectRepository(DataSource)
    private readonly sources: Repository<DataSource>,
    @InjectRepository(DataSyncJob)
    private readonly jobsRepo: Repository<DataSyncJob>,
    @InjectRepository(DataSyncRun)
    private readonly runs: Repository<DataSyncRun>,
    private readonly jobs: JobsService,
    private readonly bulk: BulkService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async listSources(organizationId: string) {
    const rows = await this.sources.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
    return rows.map(sanitizeSource)
  }

  async createSource(
    organizationId: string,
    actor: IntegrationActor,
    input: DataSourceInput,
  ) {
    if (!input.key || !input.name || !input.dbType || !input.host || !input.database || !input.secretRef) {
      throw new BadRequestException('key/name/dbType/host/database/secretRef 必填')
    }
    if (input.dbType !== 'postgres') {
      throw new BadRequestException('v1 数据库连接器仅支持 postgres')
    }
    assertSafeDbHost(input.host, input.allowlist ?? [])
    resolveSecret(input.secretRef)
    const existing = await this.sources.findOne({
      where: { organizationId, key: input.key },
    })
    if (existing) throw new ConflictException(`数据源 key 已存在：${input.key}`)
    const row = await this.sources.save(
      this.sources.create({
        organizationId,
        key: input.key,
        name: input.name,
        dbType: input.dbType,
        host: input.host,
        port: input.port ?? 5432,
        database: input.database,
        ssl: input.ssl ?? true,
        secretRef: input.secretRef,
        allowlist: input.allowlist ?? [],
        status: 'active',
        createdBy: actor.id,
      }),
    )
    await this.audit(organizationId, actor.id, 'integration.source.created', row.id, {
      key: row.key,
      host: row.host,
    })
    return sanitizeSource(row)
  }

  async testSource(organizationId: string, actor: IntegrationActor, id: string) {
    const source = await this.sources.findOne({ where: { id, organizationId } })
    if (!source) throw new NotFoundException('数据源不存在')
    let ok = false
    let detail: string | undefined
    try {
      const client = await this.connect(source)
      try {
        await client.query('BEGIN READ ONLY')
        await client.query('SELECT 1')
        await client.query('ROLLBACK')
        ok = true
      } finally {
        await client.end().catch(() => undefined)
      }
    } catch (error) {
      detail = (error as Error).message
    }
    source.lastTestedAt = new Date()
    source.lastTestStatus = ok ? 'ok' : 'failed'
    await this.sources.save(source)
    await this.audit(organizationId, actor.id, 'integration.source.tested', source.id, {
      key: source.key,
      ok,
    })
    return { ok, detail }
  }

  async listJobs(organizationId: string) {
    return this.jobsRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
  }

  async createJob(
    organizationId: string,
    actor: IntegrationActor,
    input: SyncJobInput,
  ) {
    if (!input.key || !input.name || !input.dataSourceId || !input.queryTemplate || !input.targetResourceKey) {
      throw new BadRequestException('key/name/dataSourceId/queryTemplate/targetResourceKey 必填')
    }
    if (!QUERY_TEMPLATES[input.queryTemplate]) {
      throw new BadRequestException(`查询模板未注册：${input.queryTemplate}`)
    }
    const source = await this.sources.findOne({
      where: { id: input.dataSourceId, organizationId },
    })
    if (!source) throw new NotFoundException('数据源不存在')
    await this.bulk.describe(organizationId, actor, input.targetResourceKey, 'import')
    const existing = await this.jobsRepo.findOne({
      where: { organizationId, key: input.key },
    })
    if (existing) throw new ConflictException(`同步任务 key 已存在：${input.key}`)
    const batchSize = Math.max(1, Math.min(1000, Number(input.batchSize ?? 500)))
    return this.jobsRepo.save(
      this.jobsRepo.create({
        organizationId,
        dataSourceId: source.id,
        key: input.key,
        name: input.name,
        queryTemplate: input.queryTemplate,
        queryParams: input.queryParams ?? {},
        fieldMapping: input.fieldMapping ?? {},
        targetResourceKey: input.targetResourceKey,
        mode: input.mode ?? 'incremental',
        cursorField: input.cursorField ?? null,
        watermark: null,
        batchSize,
        schedule: input.schedule ?? null,
        status: 'active',
        createdBy: actor.id,
      }),
    )
  }

  async runJob(
    organizationId: string,
    actor: IntegrationActor,
    jobId: string,
  ): Promise<DataSyncRun> {
    const job = await this.jobsRepo.findOne({
      where: { id: jobId, organizationId },
    })
    if (!job) throw new NotFoundException('同步任务不存在')
    if (job.status !== 'active') throw new ConflictException('同步任务已停用')
    if (job.mode === 'incremental' && !job.cursorField) {
      throw new BadRequestException('增量模式必须声明 cursorField')
    }
    const active = await this.runs.count({
      where: { organizationId, status: 'running' },
    })
    if (active >= 3) throw new ConflictException('并发同步运行已达上限 3')
    const run = await this.runs.save(
      this.runs.create({
        organizationId,
        jobId: job.id,
        status: 'queued',
        rowsRead: 0,
        rowsWritten: 0,
        rowsFailed: 0,
        watermarkBefore: job.watermark,
        watermarkAfter: null,
        diff: null,
        error: null,
        importRunId: null,
        startedAt: null,
        finishedAt: null,
      }),
    )
    await this.jobs.create(
      organizationId,
      { userId: actor.id, permissions: ['jobs:manage'] },
      {
        type: 'integration.sync',
        payload: { runId: run.id },
        idempotencyKey: `sync:${run.id}`,
      },
    )
    return run
  }

  async listRuns(organizationId: string, jobId?: string) {
    return this.runs.find({
      where: { organizationId, ...(jobId ? { jobId } : {}) },
      order: { createdAt: 'DESC' },
      take: 200,
    })
  }

  async processRun(organizationId: string, runId: string): Promise<DataSyncRun> {
    const run = await this.runs.findOne({ where: { id: runId, organizationId } })
    if (!run) throw new NotFoundException('同步运行不存在')
    const job = await this.jobsRepo.findOne({
      where: { id: run.jobId, organizationId },
    })
    if (!job) throw new NotFoundException('同步任务不存在')
    const source = await this.sources.findOne({
      where: { id: job.dataSourceId, organizationId },
    })
    if (!source) throw new NotFoundException('数据源不存在')
    const template = QUERY_TEMPLATES[job.queryTemplate]
    if (!template) throw new BadRequestException(`查询模板未注册：${job.queryTemplate}`)
    run.status = 'running'
    run.startedAt = new Date()
    await this.runs.save(run)
    const client = await this.connect(source)
    try {
      await client.query('BEGIN READ ONLY')
      await client.query('SET LOCAL statement_timeout = 30000')
      const params = template.params(job.watermark, job.batchSize)
      const result = await client.query(template.sql, params)
      await client.query('COMMIT')
      const sourceRows = result.rows as Array<Record<string, unknown>>
      run.rowsRead = sourceRows.length
      const mapped = sourceRows.map((row) => this.mapRow(row, job.fieldMapping))
      const cursorValues = job.cursorField
        ? sourceRows
            .map((row) => row[job.cursorField!] ?? row.updatedAt)
            .filter((value) => value !== undefined && value !== null)
            .map((value) => (value instanceof Date ? value.toISOString() : String(value)))
            .sort()
        : []
      const lastCursor = cursorValues[cursorValues.length - 1]
      run.watermarkAfter = lastCursor
        ? /^\d{4}-\d{2}-\d{2}T/.test(lastCursor)
          ? new Date(new Date(lastCursor).getTime() + 1).toISOString()
          : lastCursor
        : job.watermark
      const checksum = createHash('sha256').update(JSON.stringify(mapped)).digest('hex')
      let importRunId: string | null = null
      let written = 0
      let failed = 0
      if (mapped.length > 0) {
        const created = await this.bulk.createImport(
          organizationId,
          {
            id: job.createdBy ?? 'system:integration',
            permissions: ['imports:manage', 'jobs:manage', 'exports:manage'],
          },
          {
            resourceKey: job.targetResourceKey,
            mode: 'partial',
            idempotencyKey: `sync:${run.id}:import`,
            file: {
              buffer: Buffer.from(JSON.stringify(mapped)),
              originalName: `${job.key}.json`,
              mimeType: 'application/json',
            },
          },
        )
        importRunId = created.run.id
        written = created.run.successCount
        failed = created.run.failureCount
      }
      run.rowsWritten = written
      run.rowsFailed = failed
      run.importRunId = importRunId
      run.diff = {
        rowsRead: run.rowsRead,
        rowsWritten: written,
        rowsFailed: failed,
        sourceChecksum: checksum,
        delta: run.rowsRead - written - failed,
      }
      run.status = failed === 0 ? 'succeeded' : written > 0 ? 'partial' : 'failed'
      run.error = failed > 0 ? `${failed} 行写入失败` : null
      run.finishedAt = new Date()
      await this.runs.save(run)
      if (run.status !== 'failed') {
        job.watermark = run.watermarkAfter
        job.lastRunAt = new Date()
        await this.jobsRepo.save(job)
      }
      await this.audit(organizationId, job.createdBy ?? 'system:integration', 'integration.sync', job.id, {
        phase: 'sync',
        runId: run.id,
        rowsRead: run.rowsRead,
        rowsWritten: written,
        rowsFailed: failed,
        diff: run.diff,
      })
      return run
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      run.status = 'failed'
      run.error = (error as Error).message
      run.finishedAt = new Date()
      await this.runs.save(run)
      await this.audit(organizationId, job.createdBy ?? 'system:integration', 'integration.sync', job.id, {
        phase: 'sync-failed',
        runId: run.id,
        error: run.error,
      })
      throw error
    } finally {
      await client.end().catch(() => undefined)
    }
  }

  private mapRow(
    row: Record<string, unknown>,
    mapping: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!mapping || Object.keys(mapping).length === 0) return row
    const out: Record<string, unknown> = {}
    for (const [target, rule] of Object.entries(mapping)) {
      if (typeof rule === 'string') {
        out[target] = row[rule]
        continue
      }
      if (!rule || typeof rule !== 'object') continue
      const decl = rule as {
        from?: string
        default?: unknown
        type?: string
        enumMap?: Record<string, string>
      }
      let value = decl.from ? row[decl.from] : undefined
      if (value === undefined || value === null || value === '') {
        value = decl.default
      }
      if (value !== undefined && decl.enumMap && typeof value === 'string') {
        value = decl.enumMap[value] ?? value
      }
      if (value !== undefined && decl.type === 'number') value = Number(value)
      if (value !== undefined && decl.type === 'boolean') value = value === true || value === 'true'
      if (value !== undefined && (decl.type === 'date' || decl.type === 'datetime')) {
        value = new Date(String(value)).toISOString()
      }
      if (value !== undefined) out[target] = value
    }
    return out
  }

  private async connect(source: DataSource): Promise<Client> {
    assertSafeDbHost(source.host, source.allowlist)
    const secret = JSON.parse(resolveSecret(source.secretRef)) as {
      user?: string
      password?: string
    }
    const client = new Client({
      host: source.host,
      port: source.port,
      database: source.database,
      user: secret.user,
      password: secret.password,
      ssl: source.ssl
        ? { rejectUnauthorized: process.env.INTEGRATION_DB_TLS_INSECURE !== 'true' }
        : false,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    })
    await client.connect()
    return client
  }

  private async audit(
    organizationId: string,
    actor: string,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditLogs.create({
      organizationId,
      action,
      resource: 'connector',
      resourceId,
      actor,
      status: metadata.error ? 'failure' : 'success',
      metadata,
      source: 'integration',
    })
  }
}
