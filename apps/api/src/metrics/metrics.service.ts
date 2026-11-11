import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash } from 'node:crypto'
import { DataSource, Repository } from 'typeorm'
import {
  Dashboard,
  DashboardWidget,
  MetricAlert,
  MetricAlertEvent,
  MetricDefinition,
  MetricValue,
} from './metrics.entities'
import { MetricSourceService, type MetricPoint } from './metric-source.service'

export interface MetricsActor {
  id: string
  permissions: string[]
}

export interface QueryInput {
  metricKey: string
  from?: string
  to?: string
  dimensions?: string[]
  filters?: Record<string, unknown>
  scopeNodeIds?: string[]
  compare?: 'none' | 'previous' | 'year'
}

const SOURCE_TYPES = ['blueprint', 'platform', 'event', 'computed']
const AGGREGATIONS = ['count', 'sum', 'avg', 'min', 'max', 'ratio', 'distinct_count']
const PERIODS = ['hour', 'day', 'week', 'month']
const WIDGET_TYPES = ['number', 'bar', 'line', 'pie', 'ranking', 'table']

@Injectable()
export class MetricsService {
  private readonly cache = new Map<string, { at: number; value: unknown }>()

  constructor(
    @InjectRepository(MetricDefinition)
    private readonly definitions: Repository<MetricDefinition>,
    @InjectRepository(MetricValue)
    private readonly values: Repository<MetricValue>,
    @InjectRepository(Dashboard)
    private readonly dashboards: Repository<Dashboard>,
    @InjectRepository(DashboardWidget)
    private readonly widgets: Repository<DashboardWidget>,
    @InjectRepository(MetricAlert)
    private readonly alerts: Repository<MetricAlert>,
    @InjectRepository(MetricAlertEvent)
    private readonly alertEvents: Repository<MetricAlertEvent>,
    private readonly dataSource: DataSource,
    private readonly sources: MetricSourceService,
  ) {}

  async createDefinition(
    organizationId: string,
    actor: MetricsActor,
    input: Partial<MetricDefinition>,
  ): Promise<MetricDefinition> {
    if (!input.key || !/^[a-z][a-z0-9_.-]{1,127}$/.test(input.key)) {
      throw new BadRequestException('key 只允许小写字母开头、含 a-z0-9_.-')
    }
    if (!input.name) throw new BadRequestException('name 必填')
    if (!PERIODS.includes(String(input.period))) throw new BadRequestException('period 非法')
    if (!AGGREGATIONS.includes(String(input.aggregation))) {
      throw new BadRequestException('aggregation 非法')
    }
    if (!SOURCE_TYPES.includes(String(input.sourceType))) {
      throw new BadRequestException('sourceType 非法')
    }
    const latest = await this.definitions.find({
      where: [
        { organizationId, key: input.key },
      ],
      order: { version: 'DESC' },
      take: 1,
    })
    const version = (latest[0]?.version ?? 0) + 1
    const saved = await this.definitions.save(
      this.definitions.create({
        organizationId,
        key: input.key,
        name: input.name,
        period: input.period as never,
        aggregation: input.aggregation as never,
        sourceType: input.sourceType as never,
        sourceConfig: input.sourceConfig ?? {},
        dimensions: input.dimensions ?? [],
        filters: input.filters ?? {},
        permissions: input.permissions ?? [],
        version,
        status: 'active',
        description: input.description ?? null,
      }),
    )
    this.cache.clear()
    return saved
  }

  async listDefinitions(organizationId: string): Promise<MetricDefinition[]> {
    return this.definitions.find({
      where: [
        { organizationId, status: 'active' },
      ],
      order: { key: 'ASC', version: 'DESC' },
    })
  }

  async getDefinition(organizationId: string, key: string): Promise<MetricDefinition> {
    const rows = await this.definitions.find({
      where: [
        { organizationId, key, status: 'active' },
      ],
      order: { version: 'DESC' },
      take: 1,
    })
    if (!rows[0]) throw new NotFoundException(`指标不存在：${key}`)
    return rows[0]
  }

  async query(
    organizationId: string,
    actor: MetricsActor,
    input: QueryInput,
  ): Promise<{
    metric: { key: string; name: string; version: number; period: string; aggregation: string }
    items: MetricPoint[]
    comparison?: { mode: string; items: MetricPoint[] }
    cached: boolean
  }> {
    const definition = await this.getDefinition(organizationId, input.metricKey)
    if (
      definition.permissions.length > 0 &&
      !definition.permissions.some(
        (permission) =>
          actor.permissions.includes(permission) || actor.permissions.includes('metrics:manage'),
      )
    ) {
      throw new BadRequestException(`无权查询指标 ${input.metricKey}`)
    }
    const to = input.to ? new Date(input.to) : new Date()
    const from = input.from
      ? new Date(input.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new BadRequestException('时间范围非法')
    }
    const dimensions = (input.dimensions ?? definition.dimensions).filter((dim) =>
      definition.dimensions.includes(dim),
    )
    const key = createHash('sha256')
      .update(
        JSON.stringify({
          organizationId,
          metric: definition.key,
          version: definition.version,
          from: from.toISOString(),
          to: to.toISOString(),
          dimensions,
          filters: input.filters ?? {},
          scope: input.scopeNodeIds ?? [],
          compare: input.compare ?? 'none',
        }),
      )
      .digest('hex')
    const cached = this.cache.get(key)
    const ttl = Number(process.env.METRICS_CACHE_TTL_MS ?? 60_000)
    if (cached && Date.now() - cached.at < ttl) {
      return { ...(cached.value as object), cached: true } as never
    }
    const items = await this.sources.compute(definition, {
      organizationId,
      from,
      to,
      dimensions,
      filters: input.filters,
      scopeNodeIds: input.scopeNodeIds,
    })
    let comparison: { mode: string; items: MetricPoint[] } | undefined
    if (input.compare === 'previous' || input.compare === 'year') {
      const span = to.getTime() - from.getTime()
      const previousTo =
        input.compare === 'year' ? new Date(from.getTime()) : new Date(from.getTime())
      const previousFrom =
        input.compare === 'year' ? new Date(from.getTime() - 365 * 24 * 60 * 60 * 1000) : new Date(from.getTime() - span)
      comparison = {
        mode: input.compare,
        items: await this.sources.compute(definition, {
          organizationId,
          from: previousFrom,
          to: previousTo,
          dimensions,
          filters: input.filters,
          scopeNodeIds: input.scopeNodeIds,
        }),
      }
    }
    const result = {
      metric: {
        key: definition.key,
        name: definition.name,
        version: definition.version,
        period: definition.period,
        aggregation: definition.aggregation,
      },
      items,
      comparison,
      cached: false,
    }
    this.cache.set(key, { at: Date.now(), value: result })
    return result
  }

  async snapshot(
    organizationId: string,
    metric: MetricDefinition,
    periodStart: Date,
  ): Promise<number> {
    const periodEnd = nextPeriod(periodStart, metric.period)
    const points = await this.sources.compute(metric, {
      organizationId,
      from: periodStart,
      to: periodEnd,
      dimensions: metric.dimensions,
      filters: metric.filters,
    })
    let written = 0
    for (const point of points) {
      const dimensionHash = createHash('sha256')
        .update(JSON.stringify(point.dimensions))
        .digest('hex')
      await this.values.query(
        `INSERT INTO public.metric_values
          (id,"createdAt","updatedAt","organizationId","metricKey","metricVersion","periodStart","periodEnd",dimensions,"dimensionHash",value,"sampleCount","scopeNodeIds")
         VALUES (uuid_generate_v4(),now(),now(),$1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::text[])
         ON CONFLICT ("organizationId","metricKey","metricVersion","periodStart","dimensionHash")
         DO UPDATE SET value=EXCLUDED.value,"sampleCount"=EXCLUDED."sampleCount","scopeNodeIds"=EXCLUDED."scopeNodeIds","updatedAt"=now()`,
        [
          organizationId,
          metric.key,
          metric.version,
          periodStart,
          periodEnd,
          JSON.stringify(point.dimensions),
          dimensionHash,
          point.value,
          point.sampleCount,
          [],
        ],
      )
      written += 1
    }
    return written
  }

  async snapshotAll(organizationId: string, day?: Date): Promise<{ metrics: number; values: number }> {
    const start = startOfDay(day ?? new Date())
    const definitions = await this.listDefinitions(organizationId)
    let values = 0
    for (const metric of definitions) {
      if (metric.period !== 'day') continue
      const periodStart = startOfDayForPeriod(start, metric.period)
      values += await this.snapshot(organizationId, metric, periodStart)
    }
    return { metrics: definitions.length, values }
  }

  async backfill(
    organizationId: string,
    input: { metricKey?: string; days: number },
  ): Promise<{ days: number; values: number }> {
    const days = Math.min(365, Math.max(1, input.days))
    const definitions = input.metricKey
      ? [await this.getDefinition(organizationId, input.metricKey)]
      : (await this.listDefinitions(organizationId)).filter((item) => item.period === 'day')
    let values = 0
    for (let offset = 0; offset < days; offset += 1) {
      const day = startOfDay(new Date(Date.now() - offset * 24 * 60 * 60 * 1000))
      for (const metric of definitions) {
        values += await this.snapshot(organizationId, metric, day)
      }
    }
    return { days, values }
  }

  async listLatestValues(
    organizationId: string,
    metricKey: string,
    limit = 30,
  ): Promise<MetricValue[]> {
    return this.values.find({
      where: { organizationId, metricKey },
      order: { periodStart: 'DESC' },
      take: Math.min(500, Math.max(1, limit)),
    })
  }

  async createDashboard(
    organizationId: string,
    input: Partial<Dashboard> & { widgets?: Array<Partial<DashboardWidget>> },
  ): Promise<Dashboard> {
    if (!input.key || !input.name) throw new BadRequestException('key/name 必填')
    const existing = await this.dashboards.findOne({
      where: { organizationId, key: input.key },
    })
    if (existing) throw new ConflictException(`看板已存在：${input.key}`)
    const saved = await this.dashboards.save(
      this.dashboards.create({
        organizationId,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        visibility: input.visibility ?? {},
        defaultFilters: input.defaultFilters ?? {},
        layout: input.layout ?? [],
        status: 'active',
      }),
    )
    for (const [index, widget] of (input.widgets ?? []).entries()) {
      await this.createWidget(organizationId, saved.id, {
        ...widget,
        order: widget.order ?? index,
      })
    }
    return saved
  }

  async createWidget(
    organizationId: string,
    dashboardId: string,
    input: Partial<DashboardWidget>,
  ): Promise<DashboardWidget> {
    if (!input.key || !WIDGET_TYPES.includes(String(input.type))) {
      throw new BadRequestException('widget key/type 非法')
    }
    if (!input.metricKey) throw new BadRequestException('widget 必须引用 metricKey')
    await this.getDefinition(organizationId, input.metricKey)
    return this.widgets.save(
      this.widgets.create({
        organizationId,
        dashboardId,
        key: input.key,
        type: input.type as never,
        metricKey: input.metricKey,
        config: input.config ?? {},
        layout: input.layout ?? {},
        order: input.order ?? 0,
      }),
    )
  }

  async listDashboards(organizationId: string): Promise<Dashboard[]> {
    return this.dashboards.find({
      where: { organizationId, status: 'active' },
      order: { createdAt: 'ASC' },
    })
  }

  async getDashboard(
    organizationId: string,
    key: string,
    actor: MetricsActor,
  ): Promise<{ dashboard: Dashboard; widgets: DashboardWidget[] }> {
    const dashboard = await this.dashboards.findOne({
      where: { organizationId, key, status: 'active' },
    })
    if (!dashboard) throw new NotFoundException('看板不存在')
    const visibility = dashboard.visibility as { permissions?: string[]; roles?: string[] }
    if (
      visibility.permissions &&
      visibility.permissions.length > 0 &&
      !visibility.permissions.some((permission) => actor.permissions.includes(permission))
    ) {
      throw new BadRequestException('无权查看该看板')
    }
    const widgets = await this.widgets.find({
      where: { organizationId, dashboardId: dashboard.id },
      order: { order: 'ASC' },
    })
    return { dashboard, widgets }
  }

  async queryDashboard(
    organizationId: string,
    key: string,
    actor: MetricsActor,
    input: { from?: string; to?: string; compare?: QueryInput['compare'] } = {},
  ) {
    const { dashboard, widgets } = await this.getDashboard(organizationId, key, actor)
    const data = []
    for (const widget of widgets) {
      data.push({
        widget,
        result: await this.query(organizationId, actor, {
          metricKey: widget.metricKey,
          from: input.from,
          to: input.to,
          compare: input.compare,
          dimensions: (widget.config as { dimensions?: string[] }).dimensions,
        }),
      })
    }
    return { dashboard, widgets: data }
  }

  async createAlert(
    organizationId: string,
    input: Partial<MetricAlert>,
  ): Promise<MetricAlert> {
    if (!input.key || !input.metricKey) throw new BadRequestException('key/metricKey 必填')
    await this.getDefinition(organizationId, input.metricKey)
    if (!['gt', 'gte', 'lt', 'lte', 'no_data'].includes(String(input.operator))) {
      throw new BadRequestException('operator 非法')
    }
    return this.alerts.save(
      this.alerts.create({
        organizationId,
        key: input.key,
        metricKey: input.metricKey,
        operator: input.operator as never,
        threshold:
          input.threshold === undefined || input.threshold === null
            ? null
            : String(input.threshold),
        windowMinutes: input.windowMinutes ?? 30,
        frequencyMinutes: input.frequencyMinutes ?? 30,
        cooldownMinutes: input.cooldownMinutes ?? 60,
        scope: input.scope ?? {},
        channels: input.channels ?? [],
        status: 'active',
        silenceUntil: null,
        metadata: input.metadata ?? null,
      }),
    )
  }

  async listAlerts(organizationId: string): Promise<MetricAlert[]> {
    return this.alerts.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
  }

  async evaluateAlerts(
    organizationId: string,
    now = new Date(),
  ): Promise<{ evaluated: number; firing: number; resolved: number }> {
    const alerts = await this.alerts.find({ where: { organizationId, status: 'active' } })
    let firing = 0
    let resolved = 0
    for (const alert of alerts) {
      if (alert.silenceUntil && alert.silenceUntil > now) continue
      const definition = await this.getDefinition(organizationId, alert.metricKey)
      const from = new Date(now.getTime() - alert.windowMinutes * 60_000)
      const points = await this.sources.compute(definition, {
        organizationId,
        from,
        to: now,
        dimensions: [],
      })
      const value = points.reduce((sum, point) => sum + point.value, 0)
      const triggered = this.compare(value, alert)
      const windowKey = `${Math.floor(now.getTime() / (alert.windowMinutes * 60_000))}`
      const dedupKey = `${alert.id}:${triggered ? 'firing' : 'resolved'}:${windowKey}`
      const previous = await this.alertEvents.find({
        where: { alertId: alert.id, organizationId },
        order: { createdAt: 'DESC' },
        take: 1,
      })
      const last = previous[0]
      if (triggered) {
        if (last?.state === 'firing') {
          const cooling =
            now.getTime() - last.createdAt.getTime() < alert.cooldownMinutes * 60_000
          if (cooling) continue
        }
        await this.alertEvents
          .createQueryBuilder()
          .insert()
          .values({
            organizationId,
            alertId: alert.id,
            state: 'firing',
            value: String(value),
            dedupKey,
            notifiedAt: now,
            metadata: { metricKey: alert.metricKey, threshold: alert.threshold },
          } as never)
          .orIgnore()
          .execute()
        firing += 1
      } else if (last?.state === 'firing') {
        await this.alertEvents
          .createQueryBuilder()
          .insert()
          .values({
            organizationId,
            alertId: alert.id,
            state: 'resolved',
            value: String(value),
            dedupKey,
            notifiedAt: now,
            metadata: { metricKey: alert.metricKey },
          } as never)
          .orIgnore()
          .execute()
        resolved += 1
      }
    }
    return { evaluated: alerts.length, firing, resolved }
  }

  async listAlertEvents(organizationId: string, limit = 100): Promise<MetricAlertEvent[]> {
    return this.alertEvents.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: Math.min(500, Math.max(1, limit)),
    })
  }

  private compare(value: number, alert: MetricAlert): boolean {
    if (alert.operator === 'no_data') return value === 0
    const threshold = Number(alert.threshold ?? 0)
    switch (alert.operator) {
      case 'gt':
        return value > threshold
      case 'gte':
        return value >= threshold
      case 'lt':
        return value < threshold
      case 'lte':
        return value <= threshold
      default:
        return false
    }
  }
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function startOfDayForPeriod(date: Date, _period: string): Date {
  return startOfDay(date)
}

function nextPeriod(start: Date, period: string): Date {
  const next = new Date(start)
  if (period === 'hour') next.setHours(next.getHours() + 1)
  else if (period === 'week') next.setDate(next.getDate() + 7)
  else if (period === 'month') next.setMonth(next.getMonth() + 1)
  else next.setDate(next.getDate() + 1)
  return next
}
