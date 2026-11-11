import { BadRequestException, Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { OBJECT_STORAGE, type ObjectStorage } from '@sap/platform-core/assets/object-storage'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { toCsv, toJson, toPdf, toXlsx, type ExportRow } from './audit-export-format'

export type AuditExportFormat = 'csv' | 'json' | 'xlsx' | 'pdf'

export interface AuditExportFilter {
  actor?: string
  action?: string
  resource?: string
  resourceId?: string
  status?: string
  source?: string
  actorType?: string
  correlationId?: string
  startDate?: string
  endDate?: string
  limit?: number
}

const MIME: Record<AuditExportFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
}

/** 异步审计导出：大导出不阻塞请求，产物放对象存储，结果只存 objectKey。 */
@Injectable()
export class AuditExportJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly dataSource: DataSource,
    private readonly auditLogs: AuditLogsService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  onModuleInit(): void {
    if (this.registry.has('audit.export')) return
    this.registry.register({
      type: 'audit.export',
      typeVersion: 1,
      timeoutMs: 10 * 60_000,
      maxAttempts: 2,
      backoff: { kind: 'exponential', baseMs: 5_000, maxMs: 60_000 },
      concurrency: 1,
      payloadSchema: {
        type: 'object',
        required: ['format'],
        properties: {
          format: { enum: ['csv', 'json', 'xlsx', 'pdf'] },
          filter: { type: 'object' },
        },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => {
        const format = String(payload.format) as AuditExportFormat
        const filter = (payload.filter ?? {}) as AuditExportFilter
        await ctx.stage('querying', { format })
        const rows = await this.query(ctx.organizationId, filter)
        await ctx.stage('rendering', { rows: rows.length })
        const buffer = this.render(format, rows)
        const objectKey = `org/${ctx.organizationId}/audit/exports/${ctx.jobId}.${format}`
        await this.storage.put(objectKey, buffer, { contentType: MIME[format] })
        await ctx.progress(100, { rows: rows.length })
        await this.auditLogs.create({
          organizationId: ctx.organizationId,
          action: 'audit.export',
          resource: 'audit_log',
          actor: 'system:job',
          status: 'success',
          metadata: { format, filter, rows: rows.length, objectKey, jobId: ctx.jobId },
          source: 'job',
        })
        return { result: { objectKey, format, rows: rows.length, mime: MIME[format] } }
      },
    })
  }

  private async query(organizationId: string, filter: AuditExportFilter): Promise<ExportRow[]> {
    const where = ['"organizationId" = $1']
    const params: unknown[] = [organizationId]
    const add = (sql: string, value: unknown) => {
      params.push(value)
      where.push(sql.replace('?', `$${params.length}`))
    }
    if (filter.actor) add(`actor ILIKE ?`, `%${filter.actor}%`)
    if (filter.action) add(`action ILIKE ?`, `%${filter.action}%`)
    if (filter.resource) add(`resource ILIKE ?`, `%${filter.resource}%`)
    if (filter.resourceId) add(`"resourceId" = ?`, filter.resourceId)
    if (filter.status) add(`status = ?`, filter.status)
    if (filter.source) add(`source = ?`, filter.source)
    if (filter.actorType) add(`"actorType" = ?`, filter.actorType)
    if (filter.correlationId) add(`"correlationId" = ?`, filter.correlationId)
    if (filter.startDate) add(`timestamp >= ?`, new Date(filter.startDate))
    if (filter.endDate) add(`timestamp <= ?`, new Date(filter.endDate))
    const limit = Math.min(50_000, Math.max(1, Number(filter.limit ?? 10_000)))
    params.push(limit)
    const sql = `SELECT id, timestamp, actor, "actorType", action, resource, "resourceId", status,
                        source, "correlationId", metadata, changes, "retentionUntil", "legalHold", seq, hash
                   FROM public.audit_logs
                  WHERE ${where.join(' AND ')}
                  ORDER BY timestamp DESC
                  LIMIT $${params.length}`
    const rows = (await this.dataSource.query(sql, params)) as ExportRow[]
    return rows
  }

  private render(format: AuditExportFormat, rows: ExportRow[]): Buffer {
    switch (format) {
      case 'csv':
        return toCsv(rows)
      case 'json':
        return toJson(rows)
      case 'xlsx':
        return toXlsx(rows)
      case 'pdf':
        return toPdf(rows)
      default:
        throw new BadRequestException(`不支持的导出格式：${format}`)
    }
  }
}
