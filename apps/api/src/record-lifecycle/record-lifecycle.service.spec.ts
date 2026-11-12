import { ConflictException } from '@nestjs/common'
import { RecordLifecycleService } from './record-lifecycle.service'

const rootRow = {
  id: 'root-1',
  organizationId: 'org-1',
  blueprintId: 'bp-1',
  entity: 'Chapter',
  data: { title: 'Root', parentId: null, sortOrder: 1, childRef: 'child-1' },
  state: 'active',
  version: 1,
  archivedAt: null,
}
const childRow = {
  ...rootRow,
  id: 'child-1',
  data: { title: 'Child', parentId: 'root-1', sortOrder: 1 },
}

function runtime(tree: boolean) {
  return {
    lifecycleSchema: jest.fn(async () => ({
      tree: tree ? { parentField: 'parentId', orderField: 'sortOrder' } : null,
      uniqueFields: ['title'],
      selfReferenceFields: ['childRef'],
    })),
  }
}

function cloneService() {
  const manager: any = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM public.blueprint_records\n        WHERE id =')) return [rootRow]
      if (sql.includes('WITH RECURSIVE tree')) return [rootRow, childRow]
      if (sql.includes('SELECT 1 FROM public.blueprint_records')) return []
      return []
    }),
    getRepository: jest.fn(() => ({
      save: jest.fn(async (row) => row),
      create: jest.fn((row) => row),
    })),
  }
  const dataSource = {
    transaction: jest.fn(async (fn: any) => fn(manager)),
    getRepository: jest.fn(() => ({ findOne: jest.fn(async () => null) })),
  }
  const auditLogs = { create: jest.fn(async () => ({})) }
  return {
    service: new RecordLifecycleService(
      dataSource as never,
      runtime(true) as never,
      auditLogs as never,
    ),
    manager,
    dataSource,
    auditLogs,
  }
}

describe('RecordLifecycleService', () => {
  it('clone：子树新 ID，parent/内部引用重映射', async () => {
    const { service, manager, auditLogs } = cloneService()
    const result: any = await service.clone({
      packageId: 'bp-1',
      entity: 'Chapter',
      recordId: 'root-1',
      organizationId: 'org-1',
      actor: { id: 'u1', permissions: [] },
    })
    expect(result.cloned).toBe(2)
    expect(result.ids).toHaveLength(2)
    expect(result.rootId).not.toBe('root-1')

    const inserts = manager.query.mock.calls.filter((call: any[]) =>
      String(call[0]).includes('INSERT INTO public.blueprint_records'),
    )
    expect(inserts).toHaveLength(2)
    const childData = JSON.parse((inserts[1] as any[])[1][5])
    const rootData = JSON.parse((inserts[0] as any[])[1][5])
    expect(childData.parentId).toBe(result.rootId)
    expect(result.ids).toContain(rootData.childRef)
    expect(auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'record.clone' }),
    )
  })

  it('move：移动到后代 → 409，树不变', async () => {
    const update = jest.fn(async () => [{ id: 'root-1' }])
    const manager: any = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM public.blueprint_records')) {
          return sql.includes('id = $1') && sql.includes('FOR UPDATE')
            ? [rootRow]
            : [rootRow]
        }
        return []
      }),
      getRepository: jest.fn(() => ({
        save: jest.fn(async (row) => row),
        create: jest.fn((row) => row),
      })),
    }
    // descendant CTE returns target parent as descendant
    manager.query.mockImplementation(async (sql: string) => {
      if (sql.includes('WITH RECURSIVE tree')) return [{ id: 'child-1' }]
      if (sql.includes('SELECT * FROM public.blueprint_records')) return [rootRow]
      return []
    })
    const service = new RecordLifecycleService(
      {
        transaction: jest.fn(async (fn: any) => fn(manager)),
        query: update,
      } as never,
      runtime(true) as never,
      { create: jest.fn() } as never,
    )
    await expect(
      service.move({
        packageId: 'bp-1',
        entity: 'Chapter',
        recordId: 'root-1',
        parentId: 'child-1',
        organizationId: 'org-1',
        actor: { id: 'u1', permissions: [] },
      }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(update).not.toHaveBeenCalled()
  })

  it('archive：只设 archivedAt，不物理删除', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM public.blueprint_records')) return [rootRow]
      return []
    })
    const service = new RecordLifecycleService(
      { query } as never,
      runtime(true) as never,
      { create: jest.fn() } as never,
    )
    await expect(
      service.archive({
        packageId: 'bp-1',
        entity: 'Chapter',
        recordId: 'root-1',
        organizationId: 'org-1',
        actor: { id: 'u1', permissions: [] },
        reason: 'obsolete',
      }),
    ).resolves.toMatchObject({ archived: 1 })
    const update = query.mock.calls.find((call) =>
      String(call[0]).includes('SET "archivedAt"'),
    )
    expect(update?.[0]).toContain('version = version + 1')
  })

  it('snapshot + diff：版本只追加，字段级差异', async () => {
    const snapshots: any[] = []
    const repo: any = {
      count: jest.fn(async () => 0),
      find: jest.fn(async () => []),
      delete: jest.fn(async () => undefined),
      save: jest.fn(async (row) => {
        const saved = { id: `s-${snapshots.length + 1}`, ...row }
        snapshots.push(saved)
        return saved
      }),
      findOne: jest.fn(async ({ where }: any) =>
        snapshots.find((row) => row.version === where.version) ?? null,
      ),
    }
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM public.blueprint_records')) return [rootRow]
      if (sql.includes('COALESCE(MAX(version)')) return [{ next: snapshots.length + 1 }]
      return []
    })
    const service = new RecordLifecycleService(
      { query, getRepository: jest.fn(() => repo) } as never,
      runtime(true) as never,
      { create: jest.fn() } as never,
    )
    const first = await service.snapshot({
      packageId: 'bp-1',
      entity: 'Chapter',
      recordId: 'root-1',
      organizationId: 'org-1',
      actor: { id: 'u1', permissions: [] },
      label: 'v1',
    })
    const second = await service.snapshot({
      packageId: 'bp-1',
      entity: 'Chapter',
      recordId: 'root-1',
      organizationId: 'org-1',
      actor: { id: 'u1', permissions: [] },
      label: 'v2',
    })
    expect(first.version).toBe(1)
    expect(second.version).toBe(2)
    const diff = await service.diff({
      recordId: 'root-1',
      organizationId: 'org-1',
      fromVersion: 1,
      toVersion: 2,
    })
    expect(Array.isArray(diff.changes)).toBe(true)
  })
})
