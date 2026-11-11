import { BadRequestException } from '@nestjs/common'
import { MetricsService } from './metrics.service'
import { MetricSourceService } from './metric-source.service'

function repo(rows: any[] = []) {
  return {
    find: jest.fn(async ({ where }: any = {}) => rows),
    findOne: jest.fn(async () => rows[0] ?? null),
    save: jest.fn(async (row) => ({ id: row.id ?? 'row-1', ...row })),
    create: jest.fn((row) => row),
    count: jest.fn(async () => rows.length),
  }
}

function setup() {
  const definitions = repo([])
  const values = repo([])
  const dashboards = repo([])
  const widgets = repo([])
  const alerts = repo([])
  const events = { find: jest.fn(async () => []), createQueryBuilder: jest.fn() }
  const sources = { compute: jest.fn(async () => [{ periodStart: new Date(), dimensions: {}, value: 10, sampleCount: 2 }]) }
  return {
    service: new MetricsService(
      definitions as never,
      values as never,
      dashboards as never,
      widgets as never,
      alerts as never,
      events as never,
      { query: jest.fn(async () => []) } as never,
      sources as never,
    ),
    definitions,
    values,
    dashboards,
    widgets,
    alerts,
    events,
    sources,
  }
}

describe('MetricsService', () => {
  it('注册指标：非法 key/来源拒绝；同 key 版本递增', async () => {
    const { service, definitions } = setup()
    await expect(
      service.createDefinition('org-1', { id: 'u1', permissions: [] }, {
        key: 'BAD KEY',
        name: 'x',
        period: 'day',
        aggregation: 'count',
        sourceType: 'blueprint',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    definitions.find.mockResolvedValueOnce([{ version: 3 }])
    const created = await service.createDefinition('org-1', { id: 'u1', permissions: [] }, {
      key: 'active.students',
      name: '活跃学生',
      period: 'day',
      aggregation: 'count',
      sourceType: 'blueprint',
      sourceConfig: { entity: 'Student' },
    })
    expect(created.version).toBe(4)
  })

  it('query：无权限指标拒绝；有权限返回维度/样本', async () => {
    const { service, definitions, sources } = setup()
    definitions.find.mockResolvedValue([
      {
        id: 'm1',
        organizationId: 'org-1',
        key: 'active.students',
        name: '活跃学生',
        period: 'day',
        aggregation: 'count',
        sourceType: 'blueprint',
        sourceConfig: { entity: 'Student' },
        dimensions: ['department'],
        filters: {},
        permissions: ['metrics:read'],
        version: 1,
        status: 'active',
      },
    ])
    await expect(
      service.query('org-1', { id: 'u1', permissions: [] }, { metricKey: 'active.students' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    const result = await service.query(
      'org-1',
      { id: 'u1', permissions: ['metrics:read'] },
      { metricKey: 'active.students', dimensions: ['department'] },
    )
    expect(result.items[0]).toMatchObject({ value: 10, sampleCount: 2 })
    expect(sources.compute).toHaveBeenCalled()
  })

  it('widget 必须引用已注册指标', async () => {
    const { service, definitions } = setup()
    definitions.find.mockResolvedValue([])
    await expect(
      service.createWidget('org-1', 'd1', {
        key: 'w1',
        type: 'number',
        metricKey: 'missing',
      }),
    ).rejects.toThrow()
  })

  it('预警：无数据/阈值判断与冷却去重', async () => {
    const { service, alerts, events, sources, definitions } = setup()
    definitions.find.mockResolvedValue([
      {
        id: 'm1',
        organizationId: 'org-1',
        key: 'active.students',
        name: '活跃学生',
        period: 'day',
        aggregation: 'count',
        sourceType: 'blueprint',
        sourceConfig: { entity: 'Student' },
        dimensions: [],
        filters: {},
        permissions: [],
        version: 1,
        status: 'active',
      },
    ])
    alerts.find.mockResolvedValue([
      {
        id: 'a1',
        organizationId: 'org-1',
        key: 'low',
        metricKey: 'active.students',
        operator: 'lt',
        threshold: '5',
        windowMinutes: 30,
        cooldownMinutes: 60,
        status: 'active',
        silenceUntil: null,
      },
    ])
    sources.compute.mockResolvedValue([{ periodStart: new Date(), dimensions: {}, value: 1, sampleCount: 1 }])
    const insert = { values: jest.fn().mockReturnThis(), orIgnore: jest.fn().mockReturnThis(), execute: jest.fn(async () => ({})) }
    events.createQueryBuilder.mockReturnValue({ insert: jest.fn(() => insert) })
    const result = await service.evaluateAlerts('org-1')
    expect(result).toMatchObject({ evaluated: 1, firing: 1, resolved: 0 })
    expect(sources.compute).toHaveBeenCalled()
  })
})

describe('MetricSourceService', () => {
  it('平台表白名单拒绝未知表', async () => {
    const source = new MetricSourceService({ query: jest.fn() } as never)
    await expect(
      source.compute(
        {
          key: 'x',
          period: 'day',
          aggregation: 'count',
          sourceType: 'platform',
          sourceConfig: { table: 'secret_table' },
          dimensions: [],
        } as never,
        {
          organizationId: 'org-1',
          from: new Date(),
          to: new Date(),
          dimensions: [],
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('计算指标循环引用报错', async () => {
    const source = new MetricSourceService({ getRepository: () => ({ find: async () => [] }) } as never)
    await expect(
      source.compute(
        {
          key: 'a',
          period: 'day',
          aggregation: 'ratio',
          sourceType: 'computed',
          sourceConfig: { numerator: 'a', denominator: 'b' },
          dimensions: [],
        } as never,
        { organizationId: 'org-1', from: new Date(), to: new Date(), dimensions: [] },
      ),
    ).rejects.toThrow(/循环|不存在/)
  })
})
