import {
  deleteRecordWithIntegrity,
  formatReferrerList,
  referenceFieldsTo,
} from './record-delete'
import { RecordWriteError } from './record-write-error'
import type { SemanticEntity } from './record-validator'

const ENTITIES: SemanticEntity[] = [
  {
    name: 'Part',
    fields: [{ name: 'partNo', type: 'text' }],
    states: [{ name: 'active', initial: true }, { name: 'obsolete', final: true }],
  },
  {
    name: 'SalesOrderLine',
    fields: [
      { name: 'part', type: 'reference', reference: 'Part', required: true, onDelete: 'restrict' },
      { name: 'quantity', type: 'number' },
    ],
    states: [{ name: 'draft', initial: true }, { name: 'closed', final: true }],
  },
  {
    name: 'StockItem',
    fields: [
      { name: 'part', type: 'reference', reference: 'Part', onDelete: 'setNull' },
      { name: 'quantity', type: 'i32' },
    ],
    states: [{ name: 'inStock', initial: true }, { name: 'depleted', final: true }],
  },
]

describe('referenceFieldsTo / formatReferrerList', () => {
  it('缺省 onDelete 为 restrict；列出引用实例', () => {
    expect(referenceFieldsTo(ENTITIES, 'Part')).toEqual([
      { entity: 'SalesOrderLine', field: 'part', onDelete: 'restrict', required: true },
      { entity: 'StockItem', field: 'part', onDelete: 'setNull', required: undefined },
    ])
    expect(
      formatReferrerList([
        { entity: 'SalesOrderLine', id: 'L1', field: 'part', onDelete: 'restrict' },
      ]),
    ).toBe('SalesOrderLine:L1')
  })
})

describe('deleteRecordWithIntegrity', () => {
  it('restrict：被引用即拒，错误列出引用它的实例', async () => {
    const query = jest.fn(async (_sql: string, params: unknown[]) => {
      if (params[2] === 'SalesOrderLine') return [{ id: 'line-1', entity: 'SalesOrderLine' }]
      return []
    })
    await expect(
      deleteRecordWithIntegrity(
        { query, getRepository: () => ({}) } as never,
        {
          blueprintId: 'bp',
          organizationId: 'org',
          entity: 'Part',
          recordId: 'part-1',
          entities: ENTITIES,
          validation: [],
        },
      ),
    ).rejects.toMatchObject({ reason: 'referenced' })
    await expect(
      deleteRecordWithIntegrity(
        { query, getRepository: () => ({}) } as never,
        {
          blueprintId: 'bp',
          organizationId: 'org',
          entity: 'Part',
          recordId: 'part-1',
          entities: ENTITIES,
          validation: [],
        },
      ),
    ).rejects.toThrow(/SalesOrderLine:line-1/)
  })

  it('setNull：置空后引用方仍合法则删除目标', async () => {
    const query = jest.fn(async (_sql: string, params: unknown[]) => {
      if (params[2] === 'StockItem') return [{ id: 'stk-1', entity: 'StockItem' }]
      return []
    })
    const save = jest.fn(async (row: unknown) => row)
    const findOne = jest.fn(async () => ({
      id: 'stk-1',
      entity: 'StockItem',
      data: { part: 'part-1', quantity: 2 },
    }))
    const del = jest.fn(async () => ({ affected: 1 }))
    const find = jest.fn(async () => [])
    await deleteRecordWithIntegrity(
      {
        query,
        getRepository: () => ({ save, findOne, delete: del, find }),
      } as never,
      {
        blueprintId: 'bp',
        organizationId: 'org',
        entity: 'Part',
        recordId: 'part-1',
        entities: ENTITIES,
        validation: [],
      },
    )
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ data: { quantity: 2 } }))
    expect(del).toHaveBeenCalled()
  })

  it('setNull 会违反 required → 整件事拒', async () => {
    const requiredSetNull: SemanticEntity[] = [
      ENTITIES[0],
      {
        name: 'NeedPart',
        fields: [
          { name: 'part', type: 'reference', reference: 'Part', required: true, onDelete: 'setNull' },
        ],
        states: [{ name: 'active', initial: true }, { name: 'closed', final: true }],
      },
    ]
    const query = jest.fn(async () => [{ id: 'need-1', entity: 'NeedPart' }])
    await expect(
      deleteRecordWithIntegrity(
        {
          query,
          getRepository: () => ({
            findOne: async () => ({ id: 'need-1', entity: 'NeedPart', data: { part: 'part-1' } }),
            find: async () => [],
          }),
        } as never,
        {
          blueprintId: 'bp',
          organizationId: 'org',
          entity: 'Part',
          recordId: 'part-1',
          entities: requiredSetNull,
          validation: [],
        },
      ),
    ).rejects.toBeInstanceOf(RecordWriteError)
  })
})
