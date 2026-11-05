import {
  applyQueryIndexes,
  queryIndexDdl,
  queryIndexFieldsOf,
  queryIndexName,
} from './query-index'

const semantic = {
  entities: [
    {
      name: 'Order',
      fields: [
        { name: 'status', type: 'text', indexed: true },
        { name: 'amount', type: 'decimal', indexed: true },
        { name: 'memo', type: 'text' },
      ],
    },
  ],
}

describe('query index plan', () => {
  it('only includes indexed fields and picks the matching SQL expression', () => {
    expect(queryIndexFieldsOf(semantic)).toEqual([
      { entity: 'Order', field: 'status', sqlType: 'text' },
      { entity: 'Order', field: 'amount', sqlType: 'numeric' },
    ])
  })

  it('generates expressions identical to record-query', () => {
    const ddl = queryIndexDdl(semantic, 'demo')
    expect(ddl).toHaveLength(2)
    expect(ddl[0]).toContain("(data->>'status')")
    expect(ddl[0]).toContain('WHERE entity = \'Order\'')
    expect(ddl[0]).toContain('"blueprintId" = \'demo\'')
    expect(ddl[1]).toContain("((data->>'amount')::numeric)")
  })

  it('derives a stable, scoped index name', () => {
    expect(queryIndexName('demo', '1.0.0', 'Order', 'status')).toMatch(/^qix_br_[0-9a-f]{16}$/)
    expect(queryIndexName('demo', '1.0.0', 'Order', 'status')).toBe(
      queryIndexName('demo', '1.0.0', 'Order', 'status'),
    )
    expect(queryIndexName('demo', '1.0.0', 'Order', 'status')).not.toBe(
      queryIndexName('demo', '1.0.1', 'Order', 'status'),
    )
  })

  it('rejects unsafe identifiers instead of interpolating them into DDL', () => {
    expect(() => queryIndexDdl({ entities: [{ name: 'Order', fields: [{ name: "x'; DROP", type: 'text', indexed: true }] }] }, 'demo')).toThrow()
    expect(() => queryIndexDdl(semantic, "demo'; DROP")).toThrow()
  })

  it('applies every planned DDL through the queryable', async () => {
    const query = jest.fn(async () => [])
    await applyQueryIndexes({ query }, 'demo', semantic)
    expect(query).toHaveBeenCalledTimes(2)
  })
})
