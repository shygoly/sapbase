import { BlueprintBulkAdapter } from './blueprint-bulk.adapter'
import type { SemanticRuntimeService } from '../semantic-runtime/semantic-runtime.service'
import type { BlueprintService } from '../blueprint/blueprint.service'

const entity = {
  name: 'Part',
  fields: [
    { name: 'partNo', type: 'text', required: true },
    { name: 'name', type: 'text' },
    { name: 'unitCost', type: 'decimal' },
    {
      name: 'supplier',
      type: 'reference',
      reference: 'Supplier',
      permissions: { read: 'purchase:read' },
    },
    { name: 'total', type: 'decimal', computed: { expr: 'unitCost * 2', dependsOn: ['unitCost'] } },
  ],
}

function makeAdapter() {
  const runtime = {
    listEntities: jest.fn(async () => [entity]),
    importBatch: jest.fn(async () => ({
      imported: 2,
      validated: 0,
      failed: 1,
      errors: [{ row: 3, reason: 'required', field: 'partNo', message: 'partNo 必填' }],
    })),
    list: jest.fn(async () => ({
      total: 2,
      items: [
        { id: 'r1', data: { partNo: 'P1' }, state: 'active', version: 1, createdAt: new Date(), updatedAt: new Date() },
        { id: 'r2', data: { partNo: 'P2' }, state: null, version: 1, createdAt: new Date(), updatedAt: new Date() },
      ],
    })),
  }
  const blueprints = {
    list: () => [
      { id: 'pkg-1', file: 'pkg-1.erpkg', manifest: { blueprint: 'pkg', version: '1.0.0' } },
    ],
  }
  return {
    adapter: new BlueprintBulkAdapter(
      blueprints as unknown as BlueprintService,
      runtime as unknown as SemanticRuntimeService,
    ),
    runtime,
  }
}

const ctx = {
  organizationId: 'org-1',
  actor: { id: 'u1', permissions: ['imports:manage'] },
  resourceKey: 'blueprint:pkg-1:Part',
}

describe('BlueprintBulkAdapter', () => {
  it('描述字段：类型/必填/引用/计算字段不可导入', async () => {
    const { adapter } = makeAdapter()
    const descriptor = await adapter.describe(ctx)
    expect(descriptor.resourceKey).toBe('blueprint:pkg-1:Part')
    expect(descriptor.fields.find((field) => field.key === 'partNo')).toMatchObject({
      type: 'string',
      required: true,
      importable: true,
    })
    expect(descriptor.fields.find((field) => field.key === 'supplier')).toMatchObject({
      type: 'reference',
      referenceResource: 'blueprint:pkg-1:Supplier',
    })
    expect(descriptor.fields.find((field) => field.key === 'total')).toMatchObject({
      type: 'decimal',
      importable: false,
    })
    expect(descriptor.fields.some((field) => field.key === 'id')).toBe(true)
  })

  it('写导入委托 importBatch 并保留 mode/dryRun/错误行', async () => {
    const { adapter, runtime } = makeAdapter()
    const result = await adapter.write(
      ctx,
      [
        { row: 2, data: { partNo: 'P1' } },
        { row: 3, data: {} },
      ],
      { mode: 'partial', dryRun: true },
    )
    expect(runtime.importBatch).toHaveBeenCalledWith(
      'pkg-1',
      'Part',
      expect.any(Array),
      expect.objectContaining({ mode: 'partial', dryRun: true }),
      'org-1',
      expect.any(Object),
    )
    expect(result).toMatchObject({
      imported: 2,
      validated: 0,
      errors: [expect.objectContaining({ row: 3, field: 'partNo' })],
    })
  })

  it('导出分页透传查询并合并系统字段', async () => {
    const { adapter, runtime } = makeAdapter()
    const page = await adapter.exportPage(ctx, {
      page: 2,
      pageSize: 100,
      sort: 'partNo',
      order: 'desc',
      filter: { state: 'active' },
    })
    expect(runtime.list).toHaveBeenCalledWith(
      'pkg-1',
      'Part',
      'org-1',
      expect.objectContaining({ page: '2', pageSize: '100', state: 'active', sort: 'partNo' }),
      expect.any(Object),
    )
    expect(page.total).toBe(2)
    expect(page.rows[0]).toMatchObject({ id: 'r1', partNo: 'P1', state: 'active' })
  })

  it('资源列表跳过不可读包', async () => {
    const { adapter } = makeAdapter()
    const resources = await adapter.listResources(ctx)
    expect(resources[0].resourceKey).toBe('blueprint:pkg-1:Part')
  })
})
