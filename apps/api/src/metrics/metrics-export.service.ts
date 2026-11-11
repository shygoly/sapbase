import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { OBJECT_STORAGE, type ObjectStorage } from '@sap/platform-core/assets/object-storage'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { MetricsService, type MetricsActor } from './metrics.service'
import { toCsv, toPdf, toXlsx } from '../audit-exports/audit-export-format'

export type MetricsExportFormat = 'csv' | 'json' | 'xlsx' | 'pdf' | 'md'

const MIME: Record<MetricsExportFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  md: 'text/markdown',
}

@Injectable()
export class MetricsExportService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly metrics: MetricsService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  onModuleInit(): void {
    if (this.registry.has('metrics.export')) return
    this.registry.register({
      type: 'metrics.export',
      typeVersion: 1,
      timeoutMs: 10 * 60_000,
      maxAttempts: 2,
      backoff: { kind: 'exponential', baseMs: 5_000, maxMs: 60_000 },
      concurrency: 1,
      payloadSchema: {
        type: 'object',
        required: ['format', 'metricKeys'],
        properties: {
          format: { enum: ['csv', 'json', 'xlsx', 'pdf', 'md'] },
          metricKeys: { type: 'array', items: { type: 'string' }, minItems: 1 },
          from: { type: 'string' },
          to: { type: 'string' },
          dimensions: { type: 'array', items: { type: 'string' } },
          permissions: { type: 'array', items: { type: 'string' } },
          actorId: { type: 'string' },
        },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => {
        const format = String(payload.format) as MetricsExportFormat
        await ctx.stage('querying', { format })
        const rows: Array<{ id: string } & Record<string, unknown>> = []
        for (const key of payload.metricKeys as string[]) {
          const result = await this.metrics.query(
            ctx.organizationId,
            {
              id: String(payload.actorId ?? 'system'),
              permissions: (payload.permissions as string[]) ?? ['metrics:read'],
            } as MetricsActor,
            {
              metricKey: key,
              from: payload.from ? String(payload.from) : undefined,
              to: payload.to ? String(payload.to) : undefined,
              dimensions: (payload.dimensions as string[]) ?? undefined,
            },
          )
          for (const item of result.items) {
            rows.push({
              id: `${key}:${item.periodStart.toISOString()}:${JSON.stringify(item.dimensions)}`,
              metricKey: key,
              periodStart: item.periodStart,
              dimensions: JSON.stringify(item.dimensions),
              value: item.value,
              sampleCount: item.sampleCount,
            })
          }
        }
        await ctx.stage('rendering', { rows: rows.length })
        const buffer = render(format, rows)
        const objectKey = `org/${ctx.organizationId}/metrics/exports/${ctx.jobId}.${format}`
        await this.storage.put(objectKey, buffer, { contentType: MIME[format] })
        await ctx.progress(100, { rows: rows.length })
        return { result: { objectKey, format, rows: rows.length, mime: MIME[format] } }
      },
    })
  }
}

function render(format: MetricsExportFormat, rows: Array<{ id: string } & Record<string, unknown>>): Buffer {
  if (format === 'json') return Buffer.from(JSON.stringify(rows, null, 2))
  if (format === 'csv') return toCsv(rows)
  if (format === 'xlsx') return toXlsx(rows)
  if (format === 'pdf') return toPdf(rows)
  const lines = ['| metric | period | dimensions | value | samples |', '|---|---|---|---|---|']
  for (const row of rows) {
    lines.push(
      `| ${row.metricKey} | ${row.periodStart} | ${row.dimensions} | ${row.value} | ${row.sampleCount} |`,
    )
  }
  return Buffer.from(lines.join('\n'))
}
