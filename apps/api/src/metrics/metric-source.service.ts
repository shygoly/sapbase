import { BadRequestException, Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { MetricDefinition } from './metrics.entities'

export interface MetricComputationContext {
  organizationId: string
  from: Date
  to: Date
  dimensions: string[]
  filters?: Record<string, unknown>
  scopeNodeIds?: string[]
}

export interface MetricPoint {
  periodStart: Date
  dimensions: Record<string, unknown>
  value: number
  sampleCount: number
}

const PLATFORM_TABLES: Record<string, { columns: string[]; time: string }> = {
  users: { columns: ['id', 'role', 'status', 'createdAt'], time: 'createdAt' },
  organizations: { columns: ['id', 'subscriptionStatus', 'createdAt'], time: 'createdAt' },
  blueprint_records: { columns: ['id', 'entity', 'state', 'version', 'createdAt'], time: 'createdAt' },
  audit_logs: { columns: ['id', 'action', 'resource', 'actor', 'status', 'timestamp'], time: 'timestamp' },
  jobs: { columns: ['id', 'type', 'status', 'createdAt'], time: 'createdAt' },
  assets: { columns: ['id', 'kind', 'status', 'createdAt'], time: 'createdAt' },
  announcements: { columns: ['id', 'status', 'createdAt'], time: 'createdAt' },
}

const SAFE = /^[A-Za-z_][A-Za-z0-9_]*$/

@Injectable()
export class MetricSourceService {
  constructor(private readonly dataSource: DataSource) {}

  async compute(
    definition: MetricDefinition,
    ctx: MetricComputationContext,
    stack: string[] = [],
  ): Promise<MetricPoint[]> {
    switch (definition.sourceType) {
      case 'blueprint':
        return this.computeBlueprint(definition, ctx)
      case 'platform':
        return this.computePlatform(definition, ctx)
      case 'event':
        return this.computeEvent(definition, ctx)
      case 'computed':
        return this.computeComputed(definition, ctx, stack)
      default:
        throw new BadRequestException(`未知指标来源：${definition.sourceType}`)
    }
  }

  private async computeBlueprint(
    definition: MetricDefinition,
    ctx: MetricComputationContext,
  ): Promise<MetricPoint[]> {
    const config = definition.sourceConfig as {
      entity?: string
      blueprintId?: string
      field?: string
    }
    if (!config.entity || !SAFE.test(config.entity)) {
      throw new BadRequestException('blueprint 源必须声明合法 entity')
    }
    const period = definition.period
    const dims = ctx.dimensions.filter((dim) => SAFE.test(dim))
    const params: unknown[] = [ctx.organizationId, config.entity, ctx.from, ctx.to]
    const clauses = [
      '"organizationId" = $1',
      'entity = $2',
      '"createdAt" >= $3',
      '"createdAt" < $4',
      '"archivedAt" IS NULL',
    ]
    if (config.blueprintId) {
      params.push(config.blueprintId)
      clauses.push(`"blueprintId" = $${params.length}`)
    }
    for (const [key, value] of Object.entries(ctx.filters ?? {})) {
      if (!SAFE.test(key)) continue
      params.push(String(value))
      clauses.push(`data->>'${key}' = $${params.length}`)
    }
    if (ctx.scopeNodeIds && ctx.scopeNodeIds.length > 0) {
      params.push(ctx.scopeNodeIds)
      clauses.push(`data->>'scopeNodeId' = ANY($${params.length}::text[])`)
    }
    const agg = this.aggregationSql(definition, 'data')
    const dimSelect = dims.map((dim, index) => `data->>'${dim}' AS d${index}`).join(', ')
    const dimGroup = dims.map((_, index) => `d${index}`).join(', ')
    const sql = `SELECT date_trunc('${period}', "createdAt") AS bucket,
                        ${dimSelect || "'' AS dummy"}, ${agg} AS value, COUNT(*)::int AS samples
                   FROM public.blueprint_records
                  WHERE ${clauses.join(' AND ')}
                  GROUP BY bucket${dimGroup ? `, ${dimGroup}` : ''}
                  ORDER BY bucket ASC`
    const rows = (await this.dataSource.query(sql, params)) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      periodStart: new Date(String(row.bucket)),
      dimensions: Object.fromEntries(dims.map((dim, index) => [dim, row[`d${index}`] ?? null])),
      value: Number(row.value ?? 0),
      sampleCount: Number(row.samples ?? 0),
    }))
  }

  private async computePlatform(
    definition: MetricDefinition,
    ctx: MetricComputationContext,
  ): Promise<MetricPoint[]> {
    const config = definition.sourceConfig as {
      table?: string
      column?: string
      timeColumn?: string
    }
    const table = config.table ?? ''
    const meta = PLATFORM_TABLES[table]
    if (!meta) throw new BadRequestException(`平台表不在受控白名单：${table}`)
    const timeColumn = config.timeColumn && meta.columns.includes(config.timeColumn)
      ? config.timeColumn
      : meta.time
    const dims = ctx.dimensions.filter((dim) => meta.columns.includes(dim))
    const params: unknown[] = [ctx.from, ctx.to]
    const clauses = [`"organizationId" = $3`, `"${timeColumn}" >= $1`, `"${timeColumn}" < $2`]
    params.push(ctx.organizationId)
    for (const [key, value] of Object.entries(ctx.filters ?? {})) {
      if (!meta.columns.includes(key)) continue
      params.push(String(value))
      clauses.push(`"${key}"::text = $${params.length}`)
    }
    const agg = this.aggregationSql(definition, '')
    const dimSelect = dims.map((dim) => `"${dim}"::text AS d${dims.indexOf(dim)}`).join(', ')
    const dimGroup = dims.map((_, index) => `d${index}`).join(', ')
    const sql = `SELECT date_trunc('${definition.period}', "${timeColumn}") AS bucket,
                        ${dimSelect || "'' AS dummy"}, ${agg} AS value, COUNT(*)::int AS samples
                   FROM public."${table}"
                  WHERE ${clauses.join(' AND ')}
                  GROUP BY bucket${dimGroup ? `, ${dimGroup}` : ''}
                  ORDER BY bucket ASC`
    const rows = (await this.dataSource.query(sql, params)) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      periodStart: new Date(String(row.bucket)),
      dimensions: Object.fromEntries(dims.map((dim, index) => [dim, row[`d${index}`] ?? null])),
      value: Number(row.value ?? 0),
      sampleCount: Number(row.samples ?? 0),
    }))
  }

  private async computeEvent(
    definition: MetricDefinition,
    ctx: MetricComputationContext,
  ): Promise<MetricPoint[]> {
    const config = definition.sourceConfig as { action?: string; topic?: string }
    const params: unknown[] = [ctx.organizationId, ctx.from, ctx.to]
    const clauses = ['"organizationId" = $1', 'timestamp >= $2', 'timestamp < $3']
    if (config.action) {
      params.push(config.action)
      clauses.push(`action = $${params.length}`)
    }
    const sql = `SELECT date_trunc('${definition.period}', timestamp) AS bucket,
                        COUNT(*)::int AS value, COUNT(*)::int AS samples
                   FROM public.audit_logs
                  WHERE ${clauses.join(' AND ')}
                  GROUP BY bucket ORDER BY bucket ASC`
    const rows = (await this.dataSource.query(sql, params)) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      periodStart: new Date(String(row.bucket)),
      dimensions: {},
      value: Number(row.value ?? 0),
      sampleCount: Number(row.samples ?? 0),
    }))
  }

  private async computeComputed(
    definition: MetricDefinition,
    ctx: MetricComputationContext,
    stack: string[],
  ): Promise<MetricPoint[]> {
    if (stack.includes(definition.key)) {
      throw new BadRequestException(`计算指标存在循环引用：${[...stack, definition.key].join(' -> ')}`)
    }
    const config = definition.sourceConfig as { numerator?: string; denominator?: string }
    if (!config.numerator || !config.denominator) {
      throw new BadRequestException('computed 源必须声明 numerator/denominator')
    }
    const load = async (key: string) => {
      const rows = (await this.dataSource.getRepository(MetricDefinition).find({
        where: [
          { organizationId: ctx.organizationId, key, status: 'active' },
        ],
        order: { version: 'DESC' },
        take: 1,
      })) as MetricDefinition[]
      const metric = rows[0]
      if (!metric) throw new BadRequestException(`计算指标引用不存在：${key}`)
      return this.compute(metric, ctx, [...stack, definition.key])
    }
    const [numerator, denominator] = await Promise.all([
      load(config.numerator),
      load(config.denominator),
    ])
    const byKey = new Map(
      denominator.map((point) => [JSON.stringify(point.dimensions), point]),
    )
    return numerator.map((point) => {
      const denom = byKey.get(JSON.stringify(point.dimensions))
      return {
        ...point,
        value: denom && denom.value !== 0 ? point.value / denom.value : 0,
      }
    })
  }

  private aggregationSql(definition: MetricDefinition, dataPrefix: string): string {
    const field = (definition.sourceConfig as { field?: string }).field
    const expr = field && SAFE.test(field)
      ? dataPrefix
        ? `${dataPrefix}->>'${field}'`
        : `"${field}"`
      : '1'
    switch (definition.aggregation) {
      case 'count':
        return 'COUNT(*)::numeric'
      case 'distinct_count':
        return `COUNT(DISTINCT ${expr})::numeric`
      case 'sum':
        return `COALESCE(SUM(NULLIF(${expr}, '')::numeric), 0)`
      case 'avg':
        return `COALESCE(AVG(NULLIF(${expr}, '')::numeric), 0)`
      case 'min':
        return `COALESCE(MIN(NULLIF(${expr}, '')::numeric), 0)`
      case 'max':
        return `COALESCE(MAX(NULLIF(${expr}, '')::numeric), 0)`
      default:
        return 'COUNT(*)::numeric'
    }
  }
}
