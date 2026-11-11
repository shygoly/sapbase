import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { BlueprintRecord } from '../semantic-runtime/blueprint-record.entity'
import { SemanticRuntimeService } from '../semantic-runtime/semantic-runtime.service'

const MAX_EXPORT_ROWS = 5_000

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * 导入/导出任务适配。
 *
 * - 导入复用 SemanticRuntime 的 `importMaster`（每行独立事务、部分成功）；
 * - 导出只读当前组织 `blueprint_records`，行数/字节有上限。
 * 下游 bulk 能力可以复用这两个 job type，无需另建队列。
 */
@Injectable()
export class DataTransferJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly runtime: SemanticRuntimeService,
    @InjectRepository(BlueprintRecord)
    private readonly records: Repository<BlueprintRecord>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  onModuleInit(): void {
    if (!this.registry.has('data.import')) {
      this.registry.register({
        type: 'data.import',
        typeVersion: 1,
        timeoutMs: 10 * 60_000,
        maxAttempts: 1,
        backoff: { kind: 'fixed', baseMs: 5_000, maxMs: 5_000 },
        concurrency: 1,
        payloadSchema: {
          type: 'object',
          required: ['packageId', 'entity'],
          properties: {
            packageId: { type: 'string', minLength: 1 },
            entity: { type: 'string', minLength: 1 },
            csv: { type: 'string' },
            rows: { type: 'array', maxItems: 10_000 },
            dryRun: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        handler: async (ctx, payload) => {
          if (!payload.csv && !Array.isArray(payload.rows)) {
            throw new BadRequestException('data.import 需要 csv 或 rows')
          }
          await ctx.stage('importing', {
            packageId: payload.packageId,
            entity: payload.entity,
          })
          const result = await this.runtime.importMaster(
            String(payload.packageId),
            String(payload.entity),
            {
              csv: payload.csv,
              rows: payload.rows,
              dryRun: payload.dryRun,
            },
            ctx.organizationId,
          )
          await ctx.progress(100)
          await this.auditLogs.create({
            organizationId: ctx.organizationId,
            action: 'data.import',
            resource: 'record',
            actor: 'system:job',
            status: 'success',
            metadata: {
              jobId: ctx.jobId,
              packageId: payload.packageId,
              entity: payload.entity,
              result,
            },
            source: 'job',
          })
          return { result }
        },
      })
    }

    if (!this.registry.has('data.export')) {
      this.registry.register({
        type: 'data.export',
        typeVersion: 1,
        timeoutMs: 5 * 60_000,
        maxAttempts: 2,
        backoff: { kind: 'exponential', baseMs: 2_000, maxMs: 30_000 },
        concurrency: 2,
        payloadSchema: {
          type: 'object',
          properties: {
            entity: { type: 'string' },
            format: { type: 'string', enum: ['json', 'csv'] },
            limit: { type: 'integer', minimum: 1, maximum: MAX_EXPORT_ROWS },
          },
          additionalProperties: false,
        },
        handler: async (ctx, payload) => {
          const format = payload.format === 'csv' ? 'csv' : 'json'
          const limit = Math.min(
            MAX_EXPORT_ROWS,
            Math.max(1, Number(payload.limit ?? 1_000)),
          )
          await ctx.stage('exporting', { entity: payload.entity ?? '*', format })
          const rows = await this.records.find({
            where: {
              organizationId: ctx.organizationId,
              ...(payload.entity ? { entity: String(payload.entity) } : {}),
            },
            order: { createdAt: 'DESC' },
            take: limit,
          })
          const items = rows.map((row) => ({
            id: row.id,
            entity: row.entity,
            state: row.state ?? null,
            version: row.version,
            data: row.data,
            createdAt: row.createdAt,
          }))
          let content: string
          if (format === 'csv') {
            const headers = ['id', 'entity', 'state', 'version', 'data']
            const lines = [headers.join(',')]
            for (const item of items) {
              lines.push(
                [item.id, item.entity, item.state ?? '', item.version, item.data]
                  .map(csvCell)
                  .join(','),
              )
            }
            content = lines.join('\n')
          } else {
            content = JSON.stringify(items, null, 2)
          }
          await ctx.progress(100, { count: items.length })
          await this.auditLogs.create({
            organizationId: ctx.organizationId,
            action: 'data.export',
            resource: 'record',
            actor: 'system:job',
            status: 'success',
            metadata: { jobId: ctx.jobId, entity: payload.entity ?? null, format, count: items.length },
            source: 'job',
          })
          return {
            result: {
              entity: payload.entity ?? null,
              format,
              count: items.length,
              content,
            },
          }
        },
      })
    }
  }
}
