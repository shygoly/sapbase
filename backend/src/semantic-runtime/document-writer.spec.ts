import {
  allocateSeq,
  formatDocNumber,
  formatPeriod,
  NUMBERING_RETRY_LIMIT,
  parseDocumentPayload,
  writeDocumentOrRecord,
  type DocumentEntity,
  type WriteContext,
} from './document-writer'
import { RecordWriteError } from './record-write-error'

const ENTITIES: DocumentEntity[] = [
  {
    name: 'Customer',
    fields: [{ name: 'name', type: 'text' }],
    states: [{ name: 'active', initial: true }, { name: 'closed', final: true }],
  },
  {
    name: 'SalesOrder',
    fields: [
      { name: 'customer', type: 'reference', reference: 'Customer' },
      { name: 'quantity', type: 'number' },
      { name: 'number', type: 'text', unique: true },
    ],
    children: ['SalesOrderLine'],
    numbering: { field: 'number', prefix: 'SO-', dateFormat: 'YYYYMMDD', width: 4 },
    states: [
      { name: 'draft', initial: true },
      { name: 'confirmed' },
      { name: 'shipped', final: true },
    ],
    transitions: [
      { from: 'draft', to: 'confirmed' },
      { from: 'confirmed', to: 'shipped' },
    ],
  },
  {
    name: 'SalesOrderLine',
    fields: [
      { name: 'order', type: 'reference', reference: 'SalesOrder', required: true },
      { name: 'quantity', type: 'number', required: true },
    ],
    parent: { entity: 'SalesOrder', field: 'order' },
    states: [{ name: 'draft', initial: true }, { name: 'closed', final: true }],
  },
  {
    name: 'NestedHead',
    fields: [{ name: 'note', type: 'text' }],
    children: ['NestedLine'],
    states: [{ name: 'draft', initial: true }, { name: 'closed', final: true }],
  },
  {
    name: 'NestedLine',
    fields: [{ name: 'head', type: 'reference', reference: 'NestedHead' }],
    parent: { entity: 'NestedHead', field: 'head' },
    children: ['Ghost'],
    states: [{ name: 'draft', initial: true }, { name: 'closed', final: true }],
  },
]

const VALIDATION = [
  {
    id: 'sol-qty-positive',
    entity: 'SalesOrderLine',
    field: 'quantity',
    rule: 'greaterThan',
    value: 0,
    message: '行数量必须大于 0',
  },
]

function uniqueError(): Error {
  const error = new Error('duplicate key') as Error & { code: string }
  error.code = '23505'
  return error
}

function mockManager(options?: {
  save?: jest.Mock
  find?: jest.Mock
  query?: jest.Mock
}) {
  const saved: Array<Record<string, unknown>> = []
  const save =
    options?.save ??
    jest.fn(async (row: Record<string, unknown>) => {
      const created = { id: `id-${saved.length + 1}`, ...row }
      saved.push(created)
      return created
    })
  const find = options?.find ?? jest.fn(async () => [{ id: 'cust-1', entity: 'Customer' }])
  let allocated = 0
  const query =
    options?.query ??
    jest.fn(async (sql?: string): Promise<Array<{ seq: number }>> => {
      if (sql && String(sql).includes('blueprint_doc_counters')) {
        allocated += 1
        return [{ seq: allocated }]
      }
      return []
    })
  return {
    saved,
    save,
    find,
    query,
    manager: {
      getRepository: () => ({ create: (row: unknown) => row, save, find }),
      query,
    },
  }
}

function ctx(manager: WriteContext['manager']): WriteContext {
  return {
    manager,
    blueprintId: 'auto-parts',
    blueprintVersion: '1.0.0',
    organizationId: 'org-1',
    entities: ENTITIES,
    validation: VALIDATION,
    now: new Date('2026-09-26T00:00:00'),
  }
}

describe('parseDocumentPayload / 单号格式', () => {
  it('没有 children 键 → 普通记录', () => {
    expect(parseDocumentPayload({ quantity: 1 })).toEqual({
      kind: 'plain',
      data: { quantity: 1 },
    })
  })

  it('children 非对象 / 行非数组 → 拒', () => {
    expect(() => parseDocumentPayload({ children: [] })).toThrow(RecordWriteError)
    expect(() => parseDocumentPayload({ children: { SalesOrderLine: {} } })).toThrow(/必须是数组/)
  })

  it('formatPeriod / formatDocNumber', () => {
    const now = new Date(2026, 8, 26)
    expect(formatPeriod(now, 'YYYYMMDD')).toBe('20260926')
    expect(formatPeriod(now, 'YYYYMM')).toBe('202609')
    expect(formatPeriod(now, 'YYYY')).toBe('2026')
    expect(formatPeriod(now, 'none')).toBe('')
    expect(formatDocNumber({ field: 'number', prefix: 'SO-', width: 4 }, '20260926', 7)).toBe(
      'SO-202609260007',
    )
  })
})

describe('writeDocumentOrRecord（头行事务）', () => {
  it('行校验失败 → 抛错且行未 save（头 save 已发生，由事务回滚）', async () => {
    const { manager, save } = mockManager()
    await expect(
      writeDocumentOrRecord(ctx(manager as never), 'SalesOrder', {
        customer: 'cust-1',
        quantity: 3,
        children: { SalesOrderLine: [{ quantity: 0 }] },
      }),
    ).rejects.toMatchObject({ reason: 'validation-failed', ruleId: 'sol-qty-positive' })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0]).toMatchObject({ entity: 'SalesOrder' })
  })

  it('成功：头写入初始态 draft，行注入父引用', async () => {
    const { manager, save } = mockManager()
    const header = await writeDocumentOrRecord(ctx(manager as never), 'SalesOrder', {
      customer: 'cust-1',
      quantity: 3,
      children: {
        SalesOrderLine: [{ quantity: 1 }, { quantity: 2 }],
      },
    })
    expect(header).toMatchObject({ entity: 'SalesOrder', state: 'draft', version: 1 })
    expect(save).toHaveBeenCalledTimes(3)
    expect(save.mock.calls[1][0]).toMatchObject({
      entity: 'SalesOrderLine',
      data: { quantity: 1, order: header.id },
    })
    expect((header.data as { number: string }).number).toBe('SO-202609260001')
  })

  it('未声明的行实体 / 父引用由调用方指定 / 多级单据 → 拒', async () => {
    const { manager } = mockManager()
    await expect(
      writeDocumentOrRecord(ctx(manager as never), 'SalesOrder', {
        customer: 'cust-1',
        quantity: 1,
        children: { GhostLine: [{ quantity: 1 }] },
      }),
    ).rejects.toMatchObject({ reason: 'undeclared-child' })

    await expect(
      writeDocumentOrRecord(ctx(manager as never), 'SalesOrder', {
        customer: 'cust-1',
        quantity: 1,
        children: { SalesOrderLine: [{ quantity: 1, order: 'forged' }] },
      }),
    ).rejects.toMatchObject({ reason: 'parent-field-injected' })

    await expect(
      writeDocumentOrRecord(ctx(manager as never), 'NestedHead', {
        note: 'x',
        children: { NestedLine: [{ }] },
      }),
    ).rejects.toMatchObject({ reason: 'nested-document-unsupported' })
  })

  it('调用方指定单号字段 → 拒', async () => {
    const { manager } = mockManager()
    await expect(
      writeDocumentOrRecord(ctx(manager as never), 'SalesOrder', {
        customer: 'cust-1',
        quantity: 1,
        number: 'SO-FORGED',
      }),
    ).rejects.toMatchObject({ reason: 'numbering-injected' })
  })
})

describe('单号 DB 兜底（23505 有界重试）', () => {
  it('插入撞 23505 → 重新分配后成功，证明走了重试而不是只靠一次分配', async () => {
    let seq = 0
    const query = jest.fn(async (sql: string) => {
      if (String(sql).includes('blueprint_doc_counters')) {
        seq += 1
        return [{ seq }]
      }
      return []
    })
    let saves = 0
    const save = jest.fn(async (row: Record<string, unknown>) => {
      saves += 1
      if (saves === 1) throw uniqueError()
      return { id: 'ok', ...row }
    })
    const { manager } = mockManager({ save, query, find: jest.fn(async () => [{ id: 'cust-1', entity: 'Customer' }]) })
    const saved = await writeDocumentOrRecord(ctx(manager as never), 'SalesOrder', {
      customer: 'cust-1',
      quantity: 1,
    })
    const allocations = query.mock.calls.filter((call) =>
      String((call as unknown[])[0]).includes('blueprint_doc_counters'),
    )
    expect(allocations).toHaveLength(2)
    expect((saved.data as { number: string }).number).toBe('SO-202609260002')
  })

  it('连续 23505 超过有界次数 → numbering-exhausted', async () => {
    const save = jest.fn(async () => {
      throw uniqueError()
    })
    const { manager } = mockManager({
      save,
      find: jest.fn(async () => [{ id: 'cust-1', entity: 'Customer' }]),
    })
    await expect(
      writeDocumentOrRecord(ctx(manager as never), 'SalesOrder', {
        customer: 'cust-1',
        quantity: 1,
      }),
    ).rejects.toMatchObject({ reason: 'numbering-exhausted' })
    expect(save).toHaveBeenCalledTimes(NUMBERING_RETRY_LIMIT)
  })
})

describe('allocateSeq', () => {
  it('未返回序号 → 拒', async () => {
    await expect(
      allocateSeq({ query: async () => [] } as never, {
        blueprintId: 'b',
        organizationId: 'o',
        entity: 'SalesOrder',
        period: '20260926',
      }),
    ).rejects.toMatchObject({ reason: 'numbering-failed' })
  })
})
