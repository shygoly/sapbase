import { AuditCheckpointService } from '@sap/platform-core/audit-logs/audit-checkpoint.service'
import { AuditRetentionService } from '@sap/platform-core/audit-logs/audit-retention.service'

function checkpointRepo() {
  const store: any[] = []
  return {
    findOne: jest.fn(async ({ where }: any) =>
      store.find(
        (row) => row.organizationId === where.organizationId && (!where.seq || row.seq === where.seq),
      ) ?? null,
    ),
    create: jest.fn((row) => ({ id: 'cp-1', ...row })),
    save: jest.fn(async (row) => {
      store.push(row)
      return row
    }),
  }
}

describe('AuditCheckpointService', () => {
  beforeEach(() => {
    process.env.AUDIT_CHECKPOINT_SECRET = 'checkpoint-secret'
  })
  afterEach(() => {
    delete process.env.AUDIT_CHECKPOINT_SECRET
  })

  it('无审计行 → null', async () => {
    const service = new AuditCheckpointService(checkpointRepo() as never, {
      query: jest.fn(async () => []),
    } as never)
    await expect(service.create('org-1')).resolves.toBeNull()
  })

  it('生成 checkpoint 并 HMAC 签名；重复 seq 幂等', async () => {
    const repo = checkpointRepo()
    const service = new AuditCheckpointService(repo as never, {
      query: jest.fn(async () => [{ seq: '7', hash: 'hash-7' }]),
    } as never)
    const first = await service.create('org-1')
    expect(first).toMatchObject({ seq: '7', hash: 'hash-7' })
    expect(first?.signature).toMatch(/^[a-f0-9]{64}$/)
    await expect(service.verify(first!)).resolves.toBe(true)
    const second = await service.create('org-1')
    expect(second).toBe(first)
    expect(repo.save).toHaveBeenCalledTimes(1)
  })
})

describe('AuditRetentionService', () => {
  it('归档 JSONL + manifest + 标记 archivedAt', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { id: 'a1', seq: '1', hash: 'h1' },
        { id: 'a2', seq: '2', hash: 'h2' },
      ])
      .mockResolvedValueOnce([])
    const storage = {
      put: jest.fn(async () => undefined),
      head: jest.fn(async () => ({ checksum: 'sha' })),
    }
    const archives = { create: jest.fn((row) => row), save: jest.fn(async (row) => row) }
    const service = new AuditRetentionService(
      { query, transaction: jest.fn() } as never,
      archives as never,
      storage as never,
    )
    const result = await service.archive('org-1', 2)
    expect(result).toMatchObject({ archived: 2, fromSeq: '1', toSeq: '2' })
    expect(storage.put).toHaveBeenCalledWith(
      expect.stringContaining('org/org-1/audit/archives/1-2.jsonl'),
      expect.any(Buffer),
      { contentType: 'application/x-ndjson' },
    )
    expect(archives.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'archived', manifest: expect.objectContaining({ count: 2 }) }),
    )
  })

  it('未配置存储 → 拒绝归档', async () => {
    const service = new AuditRetentionService(
      { query: jest.fn(), transaction: jest.fn() } as never,
      { create: jest.fn(), save: jest.fn() } as never,
    )
    await expect(service.archive('org-1', 1)).rejects.toThrow(/未配置对象存储/)
  })

  it('清理：只删已归档/非 hold/过期的行，break-glass 事务', async () => {
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }]),
    }
    const dataSource = {
      transaction: jest.fn(async (fn: any) => fn(manager)),
    }
    const service = new AuditRetentionService(
      dataSource as never,
      { create: jest.fn(), save: jest.fn() } as never,
    )
    await expect(service.cleanup('org-1')).resolves.toBe(2)
    expect(manager.query).toHaveBeenCalledWith(
      `SELECT set_config('app.audit_break_glass', 'on', true)`,
    )
    expect(manager.query.mock.calls[1][0]).toContain('legalHold')
  })
})
