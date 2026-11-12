import { UsageMeteringService } from '@sap/platform-core/entitlements/usage-metering.service'

function setup(options: { existing?: any[]; rawOne?: any; rawMany?: any[] } = {}) {
  const rows = [...(options.existing ?? [])]
  const queryBuilder: any = {
    select: jest.fn(() => queryBuilder),
    addSelect: jest.fn(() => queryBuilder),
    where: jest.fn(() => queryBuilder),
    andWhere: jest.fn(() => queryBuilder),
    groupBy: jest.fn(() => queryBuilder),
    orderBy: jest.fn(() => queryBuilder),
    getRawOne: jest.fn(async () => options.rawOne ?? { total: '0' }),
    getRawMany: jest.fn(async () => options.rawMany ?? []),
  }
  const repository = {
    create: jest.fn((row: any) => ({ id: 'usage-1', ...row })),
    save: jest.fn(async (row: any) => {
      rows.push(row)
      return row
    }),
    findOne: jest.fn(async ({ where }: any) =>
      rows.find(
        (row) =>
          row.organizationId === where.organizationId &&
          row.idempotencyKey === where.idempotencyKey,
      ) ?? null,
    ),
    createQueryBuilder: jest.fn(() => queryBuilder),
  }
  const service = new UsageMeteringService(repository as never)
  return { service, repository, queryBuilder, rows }
}

describe('UsageMeteringService', () => {
  it('record 写入 UTC 自然月并保留 idempotencyKey', async () => {
    const { service, rows } = setup()
    const at = new Date('2026-11-12T10:00:00Z')
    const row = await service.record({
      organizationId: 'org-1',
      appKey: 'erp',
      metric: 'maxMonthlyToolCalls',
      quantity: 3,
      source: 'agent-tools',
      idempotencyKey: 'call-1',
      at,
    })
    expect(row).toMatchObject({
      organizationId: 'org-1',
      appKey: 'erp',
      metric: 'maxMonthlyToolCalls',
      quantity: '3.0000',
      idempotencyKey: 'call-1',
    })
    expect(rows[0].periodStart.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect(rows[0].periodEnd.toISOString()).toBe('2026-12-01T00:00:00.000Z')
  })

  it('相同 idempotencyKey 重试返回已有记录，不重复写', async () => {
    const existing = {
      id: 'usage-existing',
      organizationId: 'org-1',
      idempotencyKey: 'call-1',
      quantity: '3.0000',
    }
    const { service, repository } = setup({ existing: [existing] })
    await expect(
      service.record({
        organizationId: 'org-1',
        appKey: 'erp',
        metric: 'maxMonthlyToolCalls',
        quantity: 3,
        source: 'agent-tools',
        idempotencyKey: 'call-1',
      }),
    ).resolves.toBe(existing)
    expect(repository.save).not.toHaveBeenCalled()
  })

  it('非法用量拒绝', async () => {
    const { service } = setup()
    await expect(
      service.record({
        organizationId: 'org-1',
        appKey: 'erp',
        metric: 'm',
        quantity: -1,
        source: 'test',
      }),
    ).rejects.toThrow(/非负/)
    await expect(
      service.record({
        organizationId: '',
        appKey: 'erp',
        metric: 'm',
        quantity: 1,
        source: 'test',
      }),
    ).rejects.toThrow(/organizationId/)
  })

  it('currentUsage 按组织/app/metric/期间求和', async () => {
    const { service, queryBuilder } = setup({ rawOne: { total: '12.5000' } })
    await expect(
      service.currentUsage('org-1', 'erp', 'maxMonthlyToolCalls'),
    ).resolves.toBe(12.5)
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'usage.metric = :metric',
      { metric: 'maxMonthlyToolCalls' },
    )
  })

  it('summary 汇总本月各指标，可按 appKey 过滤', async () => {
    const { service, queryBuilder } = setup({
      rawMany: [
        { metric: 'maxMonthlyAgentRuns', quantity: '2' },
        { metric: 'maxMonthlyToolCalls', quantity: '7.5' },
      ],
    })
    await expect(service.summary('org-1', 'erp')).resolves.toEqual([
      { metric: 'maxMonthlyAgentRuns', quantity: 2 },
      { metric: 'maxMonthlyToolCalls', quantity: 7.5 },
    ])
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('usage.appKey = :appKey', {
      appKey: 'erp',
    })
  })
})
