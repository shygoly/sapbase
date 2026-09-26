import {
  constraintFieldMap,
  locateConstraintField,
  notNullConstraintDdl,
  notNullConstraintName,
  requiredScalarFieldsOf,
} from './db-constraints'
import { uniqueIndexName } from './unique-index'

const SEMANTIC = {
  entities: [
    {
      name: 'Part',
      fields: [
        { name: 'partNo', type: 'text', unique: true, required: true },
        { name: 'name', type: 'text' },
        { name: 'unitCost', type: 'decimal' },
      ],
    },
    {
      name: 'SalesOrderLine',
      fields: [
        { name: 'order', type: 'reference', required: true },
        { name: 'quantity', type: 'number', required: true },
      ],
    },
  ],
}

const BLUEPRINT_ID = 'p2-nn-proof'

describe('非空约束生成器', () => {
  it('只给标量 required 字段生成 CHECK；reference 不进非空 CHECK', () => {
    expect(requiredScalarFieldsOf(SEMANTIC)).toEqual([
      { entity: 'Part', field: 'partNo' },
      { entity: 'SalesOrderLine', field: 'quantity' },
    ])
    const ddl = notNullConstraintDdl(SEMANTIC, BLUEPRINT_ID)
    expect(ddl).toHaveLength(2)
    expect(ddl[0]).toContain(notNullConstraintName(BLUEPRINT_ID, 'Part', 'partNo'))
    expect(ddl[0]).toContain(
      `"blueprintId" <> '${BLUEPRINT_ID}' OR entity <> 'Part' OR (data->>'partNo') IS NOT NULL`,
    )
    expect(ddl[0]).toContain('IF NOT EXISTS')
  })

  it('带 default 的 required 字段不生成 CHECK（升级路径）', () => {
    const upgraded = {
      entities: [
        {
          name: 'Part',
          fields: [
            { name: 'partNo', type: 'text', required: true },
            { name: 'origin', type: 'text', required: true, default: 'CN' },
          ],
        },
      ],
    }
    expect(requiredScalarFieldsOf(upgraded)).toEqual([{ entity: 'Part', field: 'partNo' }])
    expect(notNullConstraintDdl(upgraded, BLUEPRINT_ID)).toHaveLength(1)
    expect(notNullConstraintDdl(upgraded, BLUEPRINT_ID)[0]).not.toContain('origin')
  })

  it('约束名确定性；不同蓝图/实体/字段互不覆盖', () => {
    expect(notNullConstraintName('a', 'Part', 'partNo')).toBe(notNullConstraintName('a', 'Part', 'partNo'))
    expect(notNullConstraintName('a', 'Part', 'partNo')).not.toBe(
      notNullConstraintName('b', 'Part', 'partNo'),
    )
  })

  it('负例：非法标识拒绝编入 DDL', () => {
    expect(() =>
      notNullConstraintDdl(
        { entities: [{ name: 'bad-name', fields: [{ name: 'partNo', type: 'text', required: true }] }] },
        'x',
      ),
    ).toThrow(/实体名非法/)
    expect(() =>
      notNullConstraintDdl(
        { entities: [{ name: 'Part', fields: [{ name: 'partNo', type: 'text', required: true }] }] },
        "auto'; drop",
      ),
    ).toThrow(/蓝图 id 非法/)
  })

  it('约束名可反查 entity/field（23505 / 23514）', () => {
    const map = constraintFieldMap(BLUEPRINT_ID, SEMANTIC)
    const nn = notNullConstraintName(BLUEPRINT_ID, 'Part', 'partNo')
    const ux = uniqueIndexName(BLUEPRINT_ID, 'Part', 'partNo')
    expect(locateConstraintField(map, nn)).toEqual({ entity: 'Part', field: 'partNo' })
    expect(locateConstraintField(map, ux)).toEqual({ entity: 'Part', field: 'partNo' })
    expect(locateConstraintField(map, 'no-such')).toBeUndefined()
  })
})
