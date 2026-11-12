import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { OBJECT_STORAGE, type ObjectStorage } from '@sap/platform-core/assets/object-storage'
import { AssetsService } from '@sap/platform-core/assets/assets.service'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'
import {
  BulkAdapterRegistry,
} from './bulk.registry'
import {
  BULK_LIMITS,
  BulkFormatError,
  buildTemplate,
  detectImportFormat,
  parseImportFile,
  prepareImportRows,
  renderExport,
  type RenderField,
} from './bulk-formats'
import {
  ExportRun,
  ImportMapping,
  ImportRun,
  type ExportFormat,
  type ExportRunStatus,
  type ImportMode,
  type ImportRunStatus,
} from './bulk.entities'
import type {
  AdapterContext,
  BulkActor,
  ExportQuery,
  ResourceDescriptor,
  ResourceField,
  RowError,
} from './bulk.types'

const MAX_CONCURRENT_RUNS = Number(process.env.BULK_MAX_CONCURRENT_RUNS ?? 3)
const SYNC_MAX_ROWS = Number(process.env.BULK_SYNC_MAX_ROWS ?? 500)
const ASYNC_BYTES = Number(process.env.BULK_ASYNC_BYTES ?? 2 * 1024 * 1024)
const MAX_EXPORT_ROWS = Number(process.env.BULK_MAX_EXPORT_ROWS ?? 50_000)
const EXPORT_RETENTION_DAYS = Number(process.env.BULK_EXPORT_RETENTION_DAYS ?? 7)
const EXPORT_PAGE_SIZE = 100

export type { BulkActor }

export interface BulkUser {
  id?: string
  email?: string
  role?: string | null
  permissions?: string[]
}

export function actorOf(user?: BulkUser): BulkActor {
  return {
    id: user?.id ?? user?.email ?? 'unknown',
    email: user?.email,
    role: user?.role ?? null,
    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
  }
}

export interface ImportFileInput {
  buffer: Buffer
  originalName: string
  mimeType?: string
}

export interface CreateImportInput {
  resourceKey: string
  mode?: ImportMode
  dryRun?: boolean
  idempotencyKey?: string
  mapping?: Record<string, unknown>
  mappingName?: string
  unknownColumns?: 'reject' | 'ignore'
  file?: ImportFileInput
  assetId?: string
}

export interface CreateExportInput {
  resourceKey: string
  format?: ExportFormat
  fields?: string[]
  filter?: Record<string, unknown>
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
  restrictedFieldPolicy?: 'omit' | 'reject'
  piiPolicy?: 'allow' | 'mask'
}

export interface RunProgress {
  (progress: number, stage?: string, payload?: Record<string, unknown>): Promise<void>
}

export interface RunCancelled {
  (): Promise<boolean>
}

interface ImportRunOptions {
  format?: 'csv' | 'json' | 'xlsx'
  actorId?: string
  actorRole?: string | null
  actorPermissions?: string[]
  filename?: string
  unknownColumns?: 'reject' | 'ignore'
  mapping?: Record<string, unknown>
  dryRun?: boolean
  jobId?: string
  sourceAssetId?: string
  uploaded?: boolean
  mimeType?: string
}

interface ExportRunFilters {
  actorId?: string
  actorRole?: string | null
  actorPermissions?: string[]
  filter?: Record<string, unknown>
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
  restrictedFieldPolicy?: 'omit' | 'reject'
  piiPolicy?: 'allow' | 'mask'
  jobId?: string
}

function errorKey(
  error: Pick<RowError, 'row' | 'field' | 'reason' | 'message'>,
): string {
  return `${error.row}:${error.field ?? ''}:${error.reason}:${error.message}`
}

function uniqueErrors(errors: RowError[]): RowError[] {
  const seen = new Set<string>()
  const result: RowError[] = []
  for (const error of errors) {
    const key = errorKey(error)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(error)
  }
  return result.sort((a, b) => a.row - b.row)
}

function maskValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  const text = String(value)
  if (text.includes('@')) {
    const [name, domain] = text.split('@')
    return `${(name ?? '').slice(0, 1)}***@${domain ?? ''}`
  }
  if (text.length <= 2) return '**'
  return `${text.slice(0, 1)}***${text.slice(-1)}`
}

@Injectable()
export class BulkService {
  constructor(
    private readonly registry: BulkAdapterRegistry,
    @InjectRepository(ImportRun) private readonly imports: Repository<ImportRun>,
    @InjectRepository(ExportRun) private readonly exports: Repository<ExportRun>,
    @InjectRepository(ImportMapping)
    private readonly mappings: Repository<ImportMapping>,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly assets: AssetsService,
    private readonly auditLogs: AuditLogsService,
    private readonly jobs: JobsService,
  ) {}

  async listResources(organizationId: string, actor: BulkActor) {
    const ctx: AdapterContext = { organizationId, actor, resourceKey: 'platform:users' }
    return this.registry.listResources(ctx)
  }

  async describe(
    organizationId: string,
    actor: BulkActor,
    resourceKey: string,
    direction: 'import' | 'export',
  ): Promise<ResourceDescriptor> {
    const ctx: AdapterContext = { organizationId, actor, resourceKey }
    return direction === 'import'
      ? this.registry.describeImport(ctx)
      : this.registry.describeExport(ctx)
  }

  async template(
    organizationId: string,
    actor: BulkActor,
    resourceKey: string,
    format: 'csv' | 'xlsx',
  ) {
    const descriptor = await this.describe(organizationId, actor, resourceKey, 'import')
    return buildTemplate(descriptor, format)
  }

  async createImport(
    organizationId: string,
    actor: BulkActor,
    input: CreateImportInput,
  ): Promise<{ run: ImportRun; jobId: string | null; reused: boolean }> {
    if (!input?.resourceKey) throw new BadRequestException('resourceKey 必填')
    const mode: ImportMode = input.mode === 'atomic' ? 'atomic' : 'partial'
    if (input.idempotencyKey) {
      const existing = await this.imports.findOne({
        where: { organizationId, idempotencyKey: input.idempotencyKey },
      })
      if (existing) {
        return {
          run: existing,
          jobId: (existing.options as ImportRunOptions).jobId ?? null,
          reused: true,
        }
      }
    }
    await this.assertQuota(this.imports, organizationId)
    const descriptor = await this.describe(organizationId, actor, input.resourceKey, 'import')
    const mapping = await this.resolveMapping(
      organizationId,
      input.resourceKey,
      input.mappingName,
      input.mapping,
    )
    const unknownColumns = input.unknownColumns === 'ignore' ? 'ignore' : 'reject'
    const source = await this.readImportSource(organizationId, input)
    if (source.buffer.length > BULK_LIMITS.maxFileBytes) {
      throw new BadRequestException(
        `文件过大：${source.buffer.length} bytes（上限 ${BULK_LIMITS.maxFileBytes}）`,
      )
    }
    const format = detectImportFormat(source.originalName, source.mimeType)
    let parsed: ReturnType<typeof parseImportFile>
    let prepared: ReturnType<typeof prepareImportRows>
    try {
      parsed = parseImportFile(source.buffer, format)
      prepared = prepareImportRows(descriptor, parsed, mapping, unknownColumns)
    } catch (error) {
      if (error instanceof BulkFormatError) throw new BadRequestException(error.message)
      throw error
    }
    const structural = prepared
      .flatMap((row) => row.errors)
      .find((error) =>
        [
          'empty-header',
          'duplicate-header',
          'unknown-column',
          'unknown-field',
          'duplicate-field',
          'missing-required-column',
        ].includes(error.reason),
      )
    if (structural) {
      throw new BadRequestException(
        `导入表头/列映射不合法：${structural.message}`,
      )
    }
    const run = this.imports.create({
      organizationId,
      resourceKey: input.resourceKey,
      mode,
      status: 'queued',
      idempotencyKey: input.idempotencyKey?.slice(0, 128) ?? null,
      format,
      objectKey: source.objectKey,
      rowCount: parsed.rows.length,
      mapping,
      errors: [],
      options: {
        format,
        filename: source.originalName,
        unknownColumns,
        mapping,
        dryRun: input.dryRun === true,
        sourceAssetId: input.assetId,
        uploaded: source.uploaded,
        mimeType: source.mimeType,
        actorId: actor.id,
        actorRole: actor.role ?? null,
        actorPermissions: actor.permissions,
      } satisfies ImportRunOptions,
      createdBy: actor.id,
    })
    try {
      await this.imports.save(run)
    } catch (error) {
      if ((error as { code?: string }).code === '23505' && input.idempotencyKey) {
        const existing = await this.imports.findOne({
          where: { organizationId, idempotencyKey: input.idempotencyKey },
        })
        if (existing) {
          return {
            run: existing,
            jobId: (existing.options as ImportRunOptions).jobId ?? null,
            reused: true,
          }
        }
      }
      throw error
    }
    await this.audit(organizationId, actor, 'data.import', run.id, {
      phase: 'created',
      resourceKey: run.resourceKey,
      mode,
      format,
      rows: parsed.rows.length,
      idempotencyKey: run.idempotencyKey,
      dryRun: input.dryRun === true,
    })
    if (source.uploaded) {
      run.objectKey = `org/${organizationId}/bulk/imports/${run.id}.${format}`
      try {
        await this.storage.put(run.objectKey, source.buffer, {
          contentType: source.mimeType,
        })
      } catch (error) {
        run.status = 'failed'
        run.error = `导入源文件存储失败：${(error as Error).message}`
        await this.imports.save(run)
        throw error
      }
      await this.imports.save(run)
    }

    const asyncRun =
      source.buffer.length > ASYNC_BYTES || parsed.rows.length > SYNC_MAX_ROWS
    if (!asyncRun) {
      const processed = await this.processImportRun(run.id, organizationId, actor)
      return { run: processed, jobId: null, reused: false }
    }
    let jobId: string
    try {
      jobId = await this.enqueueImport(organizationId, actor, run.id)
    } catch (error) {
      run.status = 'failed'
      run.error = `入队失败：${(error as Error).message}`
      await this.imports.save(run)
      throw error
    }
    run.options = { ...(run.options as ImportRunOptions), jobId }
    await this.imports.save(run)
    return { run, jobId, reused: false }
  }

  private async readImportSource(
    organizationId: string,
    input: CreateImportInput,
  ): Promise<{
    buffer: Buffer
    originalName: string
    mimeType?: string
    objectKey: string
    uploaded: boolean
  }> {
    if (input.file) {
      return {
        buffer: input.file.buffer,
        originalName: input.file.originalName,
        mimeType: input.file.mimeType,
        objectKey: '',
        uploaded: true,
      }
    }
    if (!input.assetId) {
      throw new BadRequestException('file 或 assetId 必须二选一')
    }
    const asset = await this.assets.get(organizationId, input.assetId)
    if (asset.status !== 'ready') {
      throw new ForbiddenException(`资产状态 ${asset.status} 不可导入`)
    }
    const buffer = await this.storage.get(asset.objectKey)
    return {
      buffer,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      objectKey: asset.objectKey,
      uploaded: false,
    }
  }

  private async resolveMapping(
    organizationId: string,
    resourceKey: string,
    mappingName?: string,
    explicit?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    let saved: Record<string, unknown> = {}
    if (mappingName) {
      const row = await this.mappings.findOne({
        where: { organizationId, resourceKey, name: mappingName },
      })
      if (!row) throw new NotFoundException(`映射不存在：${mappingName}`)
      saved = row.mapping
    }
    return { ...saved, ...(explicit ?? {}) }
  }

  private async enqueueImport(
    organizationId: string,
    actor: BulkActor,
    runId: string,
    attemptToken?: string,
  ): Promise<string> {
    const permissions = this.jobPermissions(actor, 'bulk.import')
    const { job } = await this.jobs.create(
      organizationId,
      { userId: actor.id, permissions },
      {
        type: 'bulk.import',
        payload: { runId },
        // 重试必须生成新 job；首跑用 runId 防止重复入队。
        idempotencyKey: attemptToken
          ? `bulk.import:${runId}:retry:${attemptToken}`
          : `bulk.import:${runId}`,
      },
    )
    return job.id
  }

  async importJobActor(organizationId: string, runId: string): Promise<BulkActor> {
    const run = await this.getImport(organizationId, runId)
    const options = run.options as ImportRunOptions
    return {
      id: options.actorId ?? run.createdBy ?? 'system',
      role: (options as ImportRunOptions & { actorRole?: string }).actorRole ?? null,
      permissions: Array.isArray(options.actorPermissions) ? options.actorPermissions : [],
    }
  }

  async exportJobActor(organizationId: string, runId: string): Promise<BulkActor> {
    const run = await this.getExport(organizationId, runId)
    const filters = run.filters as ExportRunFilters
    return {
      id: filters.actorId ?? run.createdBy ?? 'system',
      role: (filters as ExportRunFilters & { actorRole?: string }).actorRole ?? null,
      permissions: Array.isArray(filters.actorPermissions) ? filters.actorPermissions : [],
    }
  }

  private jobPermissions(actor: BulkActor, type: string): string[] {
    const permissions = new Set(actor.permissions)
    if (permissions.has('jobs:manage')) return [...permissions]
    permissions.add(`job:${type}:create`)
    return [...permissions]
  }

  async processImportRun(
    runId: string,
    organizationId: string,
    actor: BulkActor,
    progress?: RunProgress,
    cancelled?: RunCancelled,
  ): Promise<ImportRun> {
    const run = await this.getImport(organizationId, runId)
    if (run.status === 'cancelled') return run
    run.status = 'running'
    run.error = null
    await this.imports.save(run)
    const options = run.options as ImportRunOptions
    try {
      if (!run.objectKey) throw new BadRequestException('导入源文件不存在或已清理')
      const buffer = await this.storage.get(run.objectKey)
      const format = (options.format ?? detectImportFormat(options.filename)) as
        | 'csv'
        | 'json'
        | 'xlsx'
      await progress?.(5, 'parsing')
      const parsed = parseImportFile(buffer, format)
      const ctx: AdapterContext = {
        organizationId,
        actor,
        resourceKey: run.resourceKey,
      }
      const descriptor = await this.registry.describeImport(ctx)
      const mapping = (run.mapping ?? options.mapping ?? {}) as Record<string, unknown>
      const prepared = prepareImportRows(
        descriptor,
        parsed,
        mapping,
        options.unknownColumns === 'ignore' ? 'ignore' : 'reject',
      )
      const genericErrors = uniqueErrors(
        prepared.flatMap((row) =>
          row.errors.map((error) => ({
            ...error,
            row: row.row,
            sheet: row.sheet,
          })),
        ),
      )
      const validRows = prepared
        .filter((row) => row.errors.length === 0)
        .map((row) => ({ row: row.row, data: row.data }))
      await progress?.(15, 'validating')
      const result =
        run.mode === 'atomic' && genericErrors.length > 0
          ? { imported: 0, validated: 0, errors: [] }
          : await this.registry.importAdapter(run.resourceKey).write(
              ctx,
              validRows,
              {
                mode: run.mode,
                dryRun: options.dryRun === true,
                isCancelled: cancelled,
                onProgress: async (done, total) => {
                  const ratio = total > 0 ? done / total : 1
                  await progress?.(15 + Math.floor(ratio * 80), 'writing', { done, total })
                },
              },
            )
      const errors = uniqueErrors([...genericErrors, ...result.errors])
      const successCount = result.imported + result.validated
      run.rowCount = parsed.rows.length
      run.successCount = successCount
      run.failureCount = new Set(errors.map((error) => error.row)).size
      run.errors = errors
      run.status = this.statusOf(successCount, errors.length, options.dryRun === true)
      run.error = errors.length > 0 ? `${errors.length} 行失败` : null
      run.options = { ...options, processedAt: new Date().toISOString() }
      await this.imports.save(run)
      await progress?.(100, 'done')
      await this.audit(organizationId, actor, 'data.import', run.id, {
        phase: 'completed',
        resourceKey: run.resourceKey,
        mode: run.mode,
        dryRun: options.dryRun === true,
        rows: run.rowCount,
        success: run.successCount,
        failed: run.failureCount,
      })
      return run
    } catch (error) {
      if ((error as Error).name === 'BatchImportCancelledError') {
        run.status = 'cancelled'
        run.error = '导入已取消'
        await this.imports.save(run)
        return run
      }
      run.status = 'failed'
      run.error = error instanceof Error ? error.message : String(error)
      await this.imports.save(run)
      await this.audit(organizationId, actor, 'data.import', run.id, {
        phase: 'failed',
        resourceKey: run.resourceKey,
        error: run.error,
      })
      throw error
    }
  }

  private statusOf(
    successCount: number,
    errorCount: number,
    dryRun: boolean,
  ): ImportRunStatus {
    if (errorCount === 0) return 'succeeded'
    if (successCount > 0) return 'partial'
    return dryRun ? 'partial' : 'failed'
  }

  async listImports(organizationId: string, limit = 50): Promise<ImportRun[]> {
    return this.imports.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(200, limit)),
    })
  }

  async getImport(organizationId: string, id: string): Promise<ImportRun> {
    const run = await this.imports.findOne({ where: { id, organizationId } })
    if (!run) throw new NotFoundException('导入运行不存在')
    return run
  }

  async importErrorsCsv(
    organizationId: string,
    id: string,
    actor: BulkActor,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const run = await this.getImport(organizationId, id)
    await this.audit(organizationId, actor, 'data.import', run.id, {
      phase: 'error-report-download',
      resourceKey: run.resourceKey,
      failed: run.failureCount,
    })
    const errors = (run.errors as RowError[]) ?? []
    const csvCell = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value)
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const lines = ['sheet,row,column,field,reason,message']
    for (const error of errors) {
      lines.push(
        [
          error.sheet ?? '',
          error.row,
          error.column ?? '',
          error.field ?? '',
          error.reason,
          error.message,
        ]
          .map(csvCell)
          .join(','),
      )
    }
    return {
      buffer: Buffer.from(`\uFEFF${lines.join('\n')}`),
      filename: `import-${run.id}-errors.csv`,
    }
  }

  async cancelImport(
    organizationId: string,
    actor: BulkActor,
    id: string,
  ): Promise<ImportRun> {
    const run = await this.getImport(organizationId, id)
    if (!['queued', 'running'].includes(run.status)) {
      throw new ConflictException(`运行状态 ${run.status} 不可取消`)
    }
    run.status = 'cancelled'
    run.error = '导入已取消'
    await this.imports.save(run)
    const jobId = (run.options as ImportRunOptions).jobId
    if (jobId) {
      await this.jobs
        .cancel(organizationId, jobId, { userId: actor.id, permissions: actor.permissions })
        .catch(() => undefined)
    }
    await this.audit(organizationId, actor, 'data.import', run.id, {
      phase: 'cancelled',
      resourceKey: run.resourceKey,
    })
    return run
  }

  async retryImport(
    organizationId: string,
    actor: BulkActor,
    id: string,
  ): Promise<{ run: ImportRun; jobId: string | null }> {
    const run = await this.getImport(organizationId, id)
    if (!['failed', 'cancelled'].includes(run.status)) {
      throw new ConflictException(`运行状态 ${run.status} 不可重试（partial 请修正后重新上传）`)
    }
    if (!run.objectKey) throw new BadRequestException('源文件已清理，请重新上传')
    run.status = 'queued'
    run.errors = []
    run.successCount = 0
    run.failureCount = 0
    run.error = null
    run.options = {
      ...(run.options as ImportRunOptions),
      actorId: actor.id,
      actorRole: actor.role ?? null,
      actorPermissions: actor.permissions,
    }
    await this.imports.save(run)
    const jobId = await this.enqueueImport(
      organizationId,
      actor,
      run.id,
      `${Date.now()}`,
    )
    run.options = { ...(run.options as ImportRunOptions), jobId }
    await this.imports.save(run)
    return { run, jobId }
  }

  async createExport(
    organizationId: string,
    actor: BulkActor,
    input: CreateExportInput,
  ): Promise<{ run: ExportRun; jobId: string }> {
    if (!input?.resourceKey) throw new BadRequestException('resourceKey 必填')
    const format = this.assertExportFormat(input.format ?? 'csv')
    await this.assertQuota(this.exports, organizationId)
    const descriptor = await this.describe(organizationId, actor, input.resourceKey, 'export')
    const fields = this.selectFields(descriptor, input.fields, actor, input.restrictedFieldPolicy)
    const run = this.exports.create({
      organizationId,
      resourceKey: input.resourceKey,
      format,
      status: 'queued',
      filters: {
        actorId: actor.id,
        actorRole: actor.role ?? null,
        actorPermissions: actor.permissions,
        filter: input.filter ?? {},
        sort: input.sort,
        order: input.order,
        search: input.search,
        restrictedFieldPolicy: input.restrictedFieldPolicy ?? 'omit',
        piiPolicy: input.piiPolicy ?? 'allow',
      } satisfies ExportRunFilters,
      fields: fields.map((field) => field.key),
      rowCount: 0,
      createdBy: actor.id,
    })
    await this.exports.save(run)
    const { job } = await this.jobs.create(
      organizationId,
      { userId: actor.id, permissions: this.jobPermissions(actor, 'bulk.export') },
      {
        type: 'bulk.export',
        payload: { runId: run.id },
        idempotencyKey: `bulk.export:${run.id}`,
      },
    )
    run.filters = { ...(run.filters as ExportRunFilters), jobId: job.id }
    await this.exports.save(run)
    await this.audit(organizationId, actor, 'data.export', run.id, {
      phase: 'created',
      resourceKey: run.resourceKey,
      format,
      fields: run.fields,
      filter: input.filter ?? {},
    })
    return { run, jobId: job.id }
  }

  private assertExportFormat(format: string): ExportFormat {
    if (!['csv', 'json', 'xlsx', 'md', 'pdf'].includes(format)) {
      throw new BadRequestException(`导出格式非法：${format}`)
    }
    return format as ExportFormat
  }

  private selectFields(
    descriptor: ResourceDescriptor,
    requested: string[] | undefined,
    actor: BulkActor,
    policy: 'omit' | 'reject' = 'omit',
  ): ResourceField[] {
    const byKey = new Map(descriptor.fields.map((field) => [field.key, field]))
    const keys =
      requested && requested.length > 0
        ? [...new Set(requested)]
        : descriptor.fields.filter((field) => field.exportable !== false).map((field) => field.key)
    const selected: ResourceField[] = []
    for (const key of keys) {
      const field = byKey.get(key)
      if (!field) {
        if (policy === 'reject') throw new BadRequestException(`未声明导出字段：${key}`)
        continue
      }
      const restricted =
        field.exportable === false ||
        (field.permissions?.read !== undefined &&
          !actor.permissions.includes(field.permissions.read))
      if (restricted) {
        if (policy === 'reject') {
          throw new ForbiddenException(`无导出权限的字段：${key}`)
        }
        continue
      }
      selected.push(field)
    }
    if (selected.length === 0) {
      throw new ForbiddenException('没有可导出的字段')
    }
    return selected
  }

  async processExportRun(
    runId: string,
    organizationId: string,
    actor: BulkActor,
    progress?: RunProgress,
    cancelled?: RunCancelled,
  ): Promise<ExportRun> {
    const run = await this.getExport(organizationId, runId)
    if (run.status === 'cancelled') return run
    run.status = 'running'
    run.error = null
    await this.exports.save(run)
    const filters = run.filters as ExportRunFilters
    try {
      const ctx: AdapterContext = { organizationId, actor, resourceKey: run.resourceKey }
      const descriptor = await this.registry.describeExport(ctx)
      const fields = this.selectFields(
        descriptor,
        run.fields,
        actor,
        filters.restrictedFieldPolicy ?? 'omit',
      )
      const adapter = this.registry.exportAdapter(run.resourceKey)
      const rows: Array<Record<string, unknown>> = []
      let total = 0
      for (let page = 1; page <= Math.ceil(MAX_EXPORT_ROWS / EXPORT_PAGE_SIZE) + 1; page += 1) {
        if (cancelled && (await cancelled())) {
          run.status = 'cancelled'
          await this.exports.save(run)
          return run
        }
        const result = await adapter.exportPage(ctx, {
          page,
          pageSize: EXPORT_PAGE_SIZE,
          filter: filters.filter,
          sort: filters.sort,
          order: filters.order,
          search: filters.search,
        })
        total = result.total
        if (total > MAX_EXPORT_ROWS) {
          throw new BadRequestException(
            `导出行数 ${total} 超过上限 ${MAX_EXPORT_ROWS}，请缩小筛选范围`,
          )
        }
        if (result.rows.length === 0) break
        for (const row of result.rows) {
          const projected: Record<string, unknown> = {}
          for (const field of fields) {
            const value = row[field.key]
            projected[field.key] =
              filters.piiPolicy === 'mask' && field.pii ? maskValue(value) : value
          }
          rows.push(projected)
        }
        const ratio = total > 0 ? Math.min(1, rows.length / total) : 0
        await progress?.(5 + Math.floor(ratio * 80), 'querying', {
          rows: rows.length,
          total,
        })
        if (rows.length >= total) break
      }
      await progress?.(90, 'rendering')
      const renderFields: RenderField[] = fields.map((field) => ({
        key: field.key,
        label: field.label,
      }))
      const buffer = renderExport(run.format, rows, renderFields)
      const mimeType = this.mimeOf(run.format)
      const objectKey = `org/${organizationId}/bulk/exports/${run.id}-${Date.now()}.${run.format}`
      await this.storage.put(objectKey, buffer, { contentType: mimeType })
      const asset = await this.assets.create(organizationId, {
        objectKey,
        originalName: `${run.resourceKey.replace(/[^a-z0-9._-]+/gi, '-')}-${run.id}.${run.format}`,
        mimeType,
        size: buffer.length,
        kind: 'document',
        metadata: { exportRunId: run.id, resourceKey: run.resourceKey, rows: rows.length },
        createdBy: actor.id,
      })
      run.status = 'succeeded'
      run.rowCount = rows.length
      run.objectKey = objectKey
      run.assetId = asset.id
      run.mimeType = mimeType
      run.expiresAt = new Date(
        Date.now() + Math.max(1, EXPORT_RETENTION_DAYS) * 24 * 60 * 60 * 1000,
      )
      run.error = null
      await this.exports.save(run)
      await progress?.(100, 'done')
      await this.audit(organizationId, actor, 'data.export', run.id, {
        phase: 'completed',
        resourceKey: run.resourceKey,
        format: run.format,
        fields: run.fields,
        rows: rows.length,
        filter: filters.filter ?? {},
      })
      return run
    } catch (error) {
      if ((error as Error).name === 'BatchImportCancelledError') {
        run.status = 'cancelled'
        run.error = '导出已取消'
        await this.exports.save(run)
        return run
      }
      run.status = 'failed'
      run.error = error instanceof Error ? error.message : String(error)
      await this.exports.save(run)
      await this.audit(organizationId, actor, 'data.export', run.id, {
        phase: 'failed',
        resourceKey: run.resourceKey,
        error: run.error,
      })
      throw error
    }
  }

  private mimeOf(format: ExportFormat): string {
    const map: Record<ExportFormat, string> = {
      csv: 'text/csv',
      json: 'application/json',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      md: 'text/markdown',
      pdf: 'application/pdf',
    }
    return map[format]
  }

  async listExports(organizationId: string, limit = 50): Promise<ExportRun[]> {
    await this.sweepExpiredExports(organizationId)
    return this.exports.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(200, limit)),
    })
  }

  async getExport(organizationId: string, id: string): Promise<ExportRun> {
    const run = await this.exports.findOne({ where: { id, organizationId } })
    if (!run) throw new NotFoundException('导出运行不存在')
    return run
  }

  async exportDownload(
    organizationId: string,
    actor: BulkActor,
    id: string,
  ): Promise<{ run: ExportRun; buffer: Buffer; filename: string }> {
    const run = await this.getExport(organizationId, id)
    if (run.status !== 'succeeded') {
      throw new BadRequestException(`运行状态 ${run.status} 不可下载`)
    }
    if (!run.objectKey) throw new NotFoundException('导出结果已过期或清理')
    if (run.expiresAt && run.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('导出结果已过期')
    }
    const buffer = await this.storage.get(run.objectKey)
    await this.audit(organizationId, actor, 'data.export', run.id, {
      phase: 'download',
      resourceKey: run.resourceKey,
      format: run.format,
      rows: run.rowCount,
    })
    return {
      run,
      buffer,
      filename: `${run.resourceKey.replace(/[^a-z0-9._-]+/gi, '-')}.${run.format}`,
    }
  }

  async exportSignedUrl(
    organizationId: string,
    actor: BulkActor,
    id: string,
    ttlSeconds = 300,
  ): Promise<{ url: string; expiresIn: number }> {
    const run = await this.getExport(organizationId, id)
    if (run.status !== 'succeeded' || !run.objectKey) {
      throw new NotFoundException('导出结果不存在')
    }
    if (run.expiresAt && run.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('导出结果已过期')
    }
    const ttl = Math.max(30, Math.min(900, ttlSeconds))
    const url = await this.storage.signedUrl(run.objectKey, 'read', ttl)
    await this.audit(organizationId, actor, 'data.export', run.id, {
      phase: 'signed-url',
      resourceKey: run.resourceKey,
      ttl,
    })
    return { url, expiresIn: ttl }
  }

  async cancelExport(
    organizationId: string,
    actor: BulkActor,
    id: string,
  ): Promise<ExportRun> {
    const run = await this.getExport(organizationId, id)
    if (!['queued', 'running'].includes(run.status)) {
      throw new ConflictException(`运行状态 ${run.status} 不可取消`)
    }
    run.status = 'cancelled'
    run.error = '导出已取消'
    await this.exports.save(run)
    const jobId = (run.filters as ExportRunFilters).jobId
    if (jobId) {
      await this.jobs
        .cancel(organizationId, jobId, { userId: actor.id, permissions: actor.permissions })
        .catch(() => undefined)
    }
    await this.audit(organizationId, actor, 'data.export', run.id, {
      phase: 'cancelled',
      resourceKey: run.resourceKey,
    })
    return run
  }

  async sweepExpiredExports(organizationId: string): Promise<number> {
    const candidates = await this.exports
      .createQueryBuilder('run')
      .where('run."organizationId" = :organizationId', { organizationId })
      .andWhere('run.status = :status', { status: 'succeeded' })
      .andWhere('run."expiresAt" IS NOT NULL AND run."expiresAt" < now()')
      .getMany()
    let cleaned = 0
    for (const run of candidates) {
      if (run.objectKey) await this.storage.delete(run.objectKey).catch(() => undefined)
      if (run.assetId) await this.assets.softDelete(organizationId, run.assetId).catch(() => undefined)
      run.objectKey = null
      run.assetId = null
      run.error = 'expired'
      await this.exports.save(run)
      cleaned += 1
    }
    return cleaned
  }

  async listMappings(organizationId: string, resourceKey?: string): Promise<ImportMapping[]> {
    return this.mappings.find({
      where: {
        organizationId,
        ...(resourceKey ? { resourceKey } : {}),
      },
      order: { createdAt: 'DESC' },
    })
  }

  async saveMapping(
    organizationId: string,
    actor: BulkActor,
    input: { resourceKey: string; name: string; mapping: Record<string, unknown> },
  ): Promise<ImportMapping> {
    if (!input?.resourceKey || !input?.name) {
      throw new BadRequestException('resourceKey/name 必填')
    }
    await this.describe(organizationId, actor, input.resourceKey, 'import')
    const existing = await this.mappings.findOne({
      where: { organizationId, resourceKey: input.resourceKey, name: input.name },
    })
    if (existing) {
      existing.mapping = input.mapping ?? {}
      existing.createdBy = actor.id
      return this.mappings.save(existing)
    }
    return this.mappings.save(
      this.mappings.create({
        organizationId,
        resourceKey: input.resourceKey,
        name: input.name,
        mapping: input.mapping ?? {},
        createdBy: actor.id,
      }),
    )
  }

  async deleteMapping(organizationId: string, id: string): Promise<void> {
    const result = await this.mappings.delete({ id, organizationId })
    if (!result.affected) throw new NotFoundException('映射不存在')
  }

  private async assertQuota(
    repo: Repository<ImportRun> | Repository<ExportRun>,
    organizationId: string,
  ): Promise<void> {
    const active = await repo.count({
      where: {
        organizationId,
        status: In(['queued', 'running']) as never,
      },
    })
    if (active >= MAX_CONCURRENT_RUNS) {
      throw new ConflictException(
        `并发导入/导出运行已达上限 ${MAX_CONCURRENT_RUNS}，请稍后重试`,
      )
    }
  }

  private async audit(
    organizationId: string,
    actor: BulkActor,
    action: 'data.import' | 'data.export',
    resourceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLogs.create({
      organizationId,
      action,
      resource: 'record',
      resourceId,
      actor: actor.id,
      status: metadata.phase === 'failed' ? 'failure' : 'success',
      metadata,
      source: 'bulk',
    })
  }
}

export type { ExportRunStatus }
