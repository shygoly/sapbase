import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { RecordLifecycleService } from '../src/record-lifecycle/record-lifecycle.service'
import { RecordSnapshot } from '../src/record-lifecycle/record-snapshot.entity'
import { RecordOperation } from '../src/record-lifecycle/record-operation.entity'
import { BlueprintRecord } from '../src/semantic-runtime/blueprint-record.entity'

describe('Record lifecycle e2e (tree + snapshots)', () => {
  let dataSource: DataSource
  let available = true
  let organizationId = ''
  const blueprintId = `e2e-tree-${Date.now()}`
  const rootId = randomUUID()
  const childId = randomUUID()
  const ids = [rootId, childId]

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME || 'mac',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sapbasic',
      entities: [BlueprintRecord, RecordSnapshot, RecordOperation],
      synchronize: false,
    })
    try {
      await dataSource.initialize()
      const rows = (await dataSource.query(
        `SELECT id FROM public.organizations ORDER BY "createdAt" LIMIT 1`,
      )) as Array<{ id: string }>
      organizationId = rows[0]?.id ?? ''
      if (!organizationId) available = false
    } catch {
      available = false
    }
  })

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource.query(`DELETE FROM record_snapshots WHERE "recordId" = ANY($1::uuid[])`, [ids])
      await dataSource.query(`DELETE FROM record_operations WHERE "recordId" = ANY($1::uuid[])`, [ids])
      await dataSource.query(`DELETE FROM blueprint_records WHERE id = ANY($1::uuid[])`, [ids])
      await dataSource.query(`DELETE FROM blueprint_records WHERE "blueprintId" = $1`, [`${blueprintId}-copy`])
    }
    if (dataSource?.isInitialized) await dataSource.destroy()
  })

  it('clone 子树 → move 防环 → archive 级联 → snapshot/diff/restore', async () => {
    if (!available) return
    await dataSource.query(
      `INSERT INTO blueprint_records (id,"createdAt","updatedAt","organizationId","blueprintId",entity,data,state,version)
       VALUES
       ($1,now(),now(),$3,$4,'Chapter',$5::jsonb,'active',1),
       ($2,now(),now(),$3,$4,'Chapter',$6::jsonb,'active',1)`,
      [
        rootId,
        childId,
        organizationId,
        blueprintId,
        JSON.stringify({ title: 'Root', parentId: null, sortOrder: 1 }),
        JSON.stringify({ title: 'Child', parentId: rootId, sortOrder: 1 }),
      ],
    )
    const runtime = {
      lifecycleSchema: jest.fn(async () => ({
        tree: { parentField: 'parentId', orderField: 'sortOrder' },
        uniqueFields: [],
        selfReferenceFields: [],
      })),
    }
    const service = new RecordLifecycleService(
      dataSource,
      runtime as never,
      { create: jest.fn(async () => ({})) } as never,
    )
    const actor = { id: 'e2e-user', permissions: ['record:clone'] }

    const cloned: any = await service.clone({
      packageId: packageIdOf(blueprintId),
      entity: 'Chapter',
      recordId: rootId,
      organizationId,
      actor,
      idempotencyKey: `clone-${blueprintId}`,
    })
    expect(cloned?.cloned).toBe(2)
    ids.push(...(cloned?.ids ?? []))

    const clonedChild = (await dataSource.query(
      `SELECT data FROM blueprint_records WHERE id = $1`,
      [cloned?.mapping?.[childId]],
    )) as Array<{ data: Record<string, unknown> }>
    expect(clonedChild[0].data.parentId).toBe(cloned?.rootId)

    await expect(
      service.move({
        packageId: packageIdOf(blueprintId),
        entity: 'Chapter',
        recordId: rootId,
        parentId: childId,
        organizationId,
        actor: { id: 'e2e-user', permissions: ['record:move'] },
      }),
    ).rejects.toThrow(/成环|后代/)

    const archiveResult: any = await service.archive({
      packageId: packageIdOf(blueprintId),
      entity: 'Chapter',
      recordId: rootId,
      organizationId,
      actor: { id: 'e2e-user', permissions: ['record:archive'] },
      reason: 'e2e',
      cascade: true,
    })
    const archived = (await dataSource.query(
      `SELECT count(*)::int AS count FROM blueprint_records
        WHERE id = ANY($1::uuid[]) AND "archivedAt" IS NOT NULL`,
      [[rootId, childId]],
    )) as Array<{ count: number }>
    expect(archived[0].count).toBe(2)

    await service.restore({
      packageId: packageIdOf(blueprintId),
      entity: 'Chapter',
      recordId: rootId,
      organizationId,
      actor: { id: 'e2e-user', permissions: ['record:archive'] },
    })

    const first = await service.snapshot({
      packageId: packageIdOf(blueprintId),
      entity: 'Chapter',
      recordId: rootId,
      organizationId,
      actor: { id: 'e2e-user', permissions: ['record:snapshot'] },
      label: 'v1',
    })
    await dataSource.query(
      `UPDATE blueprint_records SET data = $1::jsonb WHERE id = $2`,
      [JSON.stringify({ title: 'Root v2', parentId: null, sortOrder: 2 }), rootId],
    )
    const second = await service.snapshot({
      packageId: packageIdOf(blueprintId),
      entity: 'Chapter',
      recordId: rootId,
      organizationId,
      actor: { id: 'e2e-user', permissions: ['record:snapshot'] },
      label: 'v2',
    })
    const diff = await service.diff({
      recordId: rootId,
      organizationId,
      fromVersion: first.version,
      toVersion: second.version,
    })
    expect(diff.changes.map((item) => item.field)).toEqual(
      expect.arrayContaining(['title', 'sortOrder']),
    )

    const restored: any = await service.restoreSnapshot({
      snapshotId: first.id,
      organizationId,
      actor: { id: 'e2e-user', permissions: ['record:snapshot'] },
    })
    expect(restored.restoredFrom).toBe(first.version)
    expect(restored.newVersion).toBeGreaterThan(second.version)
    const current = (await dataSource.query(
      `SELECT data FROM blueprint_records WHERE id = $1`,
      [rootId],
    )) as Array<{ data: Record<string, unknown> }>
    expect(current[0].data.title).toBe('Root')
  })
})

function packageIdOf(blueprintId: string): string {
  return blueprintId
}
