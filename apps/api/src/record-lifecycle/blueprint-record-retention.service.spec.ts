import { BadRequestException } from '@nestjs/common'
import { BlueprintRecordRetentionService } from './blueprint-record-retention.service'
import { BlueprintRecordRetentionJobService } from './blueprint-record-retention.job'

function serviceWith(options: {
  stats?: Record<string, unknown>
  candidates?: number | string
  deleted?: Array<{ id: string }>
  orgs?: Array<{ id: string }>
} = {}) {
  const calls: Array<{ sql: string; params?: unknown[] }> = []
  const dataSource = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params })
      if (sql.includes('COUNT(*)::int AS "totalRows"')) {
        return [
          options.stats ?? {
            totalRows: 100,
            activeRows: 80,
            archivedRows: 20,
            oldestArchivedAt: '2024-01-01T00:00:00.000Z',
            tableBytes: 1024,
          },
        ]
      }
      if (sql.includes('FROM public.organizations')) {
        return options.orgs ?? [{ id: 'org-1' }, { id: 'org-2' }]
      }
      if (sql.includes('candidates')) {
        return [{ count: options.candidates ?? 3 }]
      }
      if (sql.includes('DELETE FROM public.blueprint_records')) {
        return options.deleted ?? [{ id: 'r1' }]
      }
      return []
    }),
  }
  const audit = { create: jest.fn(async () => ({})) }
  const service = new BlueprintRecordRetentionService(
    dataSource as never,
    audit as never,
  )
  return { service, dataSource, audit, calls }
}

describe('BlueprintRecordRetentionService', () => {
  it('stats 返回行数/归档数/表大小', async () => {
    const { service } = serviceWith()
    await expect(service.stats('org-1')).resolves.toEqual({
      organizationId: 'org-1',
      totalRows: 100,
      activeRows: 80,
      archivedRows: 20,
      oldestArchivedAt: '2024-01-01T00:00:00.000Z',
      tableBytes: 1024,
    })
  })

  it('dry-run 只统计候选，不删除、不写审计', async () => {
    const { service, dataSource, audit } = serviceWith({ candidates: 7 })
    const result = await service.prune('org-1', {
      olderThanDays: 365,
      batch: 5,
      dryRun: true,
      now: new Date('2026-11-12T00:00:00Z'),
    })
    expect(result).toMatchObject({
      dryRun: true,
      candidates: 5,
      deleted: 0,
      hasMore: true,
    })
    expect(
      dataSource.query.mock.calls.some(([sql]) => String(sql).includes('DELETE FROM')),
    ).toBe(false)
    expect(audit.create).not.toHaveBeenCalled()
  })

  it('实际 prune 只删已归档过期行并写审计', async () => {
    const { service, audit } = serviceWith({
      candidates: 3,
      deleted: [{ id: 'r1' }, { id: 'r2' }],
    })
    const result = await service.prune('org-1', {
      olderThanDays: 365,
      batch: 10,
      now: new Date('2026-11-12T00:00:00Z'),
      actor: 'admin@example.com',
    })
    expect(result).toMatchObject({
      deleted: 2,
      candidates: 3,
      hasMore: false,
    })
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'blueprint_records.retention_pruned',
        actor: 'admin@example.com',
        metadata: expect.objectContaining({ deleted: 2, olderThanDays: 365 }),
      }),
    )
  })

  it('保留期少于 30 天拒绝，避免误删', async () => {
    const { service } = serviceWith()
    await expect(
      service.prune('org-1', { olderThanDays: 7 }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('分区建议按行数/字节阈值给出理由', () => {
    const { service } = serviceWith()
    expect(
      service.recommendPartition({ totalRows: 100, tableBytes: 1024 }),
    ).toMatchObject({ recommended: false })
    expect(
      service.recommendPartition({ totalRows: 50_000_001, tableBytes: 1024 }),
    ).toMatchObject({ recommended: true, reason: expect.stringContaining('rows') })
    expect(
      service.recommendPartition({ totalRows: 1, tableBytes: 50 * 1024 * 1024 * 1024 }),
    ).toMatchObject({ recommended: true, reason: expect.stringContaining('bytes') })
  })
})

describe('BlueprintRecordRetentionJobService', () => {
  it('按组织 fan-out，单组织失败不阻断其他组织', async () => {
    const dataSource = {
      query: jest.fn(async () => [{ id: 'org-1' }, { id: 'org-2' }]),
    }
    const retention = {
      prune: jest
        .fn()
        .mockResolvedValueOnce({ deleted: 2 })
        .mockRejectedValueOnce(new Error('boom')),
    }
    const job = new BlueprintRecordRetentionJobService(
      dataSource as never,
      retention as never,
    )
    await expect(job.pruneAll()).resolves.toEqual({
      organizations: 2,
      deleted: 2,
    })
    expect(retention.prune).toHaveBeenCalledTimes(2)
    expect(retention.prune).toHaveBeenCalledWith('org-1', {
      actor: 'system:cron',
    })
  })
})
