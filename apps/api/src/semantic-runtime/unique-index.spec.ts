import {
  applyUniqueIndexes,
  uniqueIndexDdl,
  uniqueIndexName,
  uniqueFieldsOf,
} from './unique-index'

// 生成器的**纯函数**判据（不碰数据库）。
// 「唯一索引真的拦得住直连 INSERT」需要真实 PostgreSQL，按仓库既有分工放在
// `backend/test/unique-index-db.e2e-spec.ts`（单元 job 没有数据库服务，见
// `.github/workflows/ci.yml` 的 apps 注释）。

const SEMANTIC = {
  entities: [
    {
      name: 'Part',
      fields: [
        { name: 'partNo', unique: true },
        { name: 'name' },
      ],
    },
  ],
}

const BLUEPRINT_ID = 'p0-unique-proof'
const INDEX_NAME = uniqueIndexName(BLUEPRINT_ID, 'Part', 'partNo')

describe('uniqueIndexDdl / uniqueFieldsOf（生成器）', () => {
  it('为 unique 字段产出确定性部分唯一索引 DDL', () => {
    const first = uniqueIndexDdl(SEMANTIC, BLUEPRINT_ID)
    const second = uniqueIndexDdl(SEMANTIC, BLUEPRINT_ID)
    expect(uniqueFieldsOf(SEMANTIC)).toEqual([{ entity: 'Part', field: 'partNo' }])
    expect(first).toHaveLength(1)
    expect(first).toEqual(second)
    expect(first[0]).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX_NAME}`)
    expect(first[0]).toContain(`(data->>'partNo')`)
    expect(first[0]).toContain('"blueprintId"')
    expect(first[0]).toContain('"organizationId"')
    expect(first[0]).toContain(`WHERE entity = 'Part'`)
  })

  it('没有 unique 字段 → 空 DDL', () => {
    expect(uniqueIndexDdl({ entities: [{ name: 'Part', fields: [{ name: 'name' }] }] }, 'x')).toEqual(
      [],
    )
  })

  it('索引名确定性且含实体与字段（不同蓝图/实体/字段互不覆盖）', () => {
    expect(uniqueIndexName('bp-a', 'Part', 'partNo')).toBe(uniqueIndexName('bp-a', 'Part', 'partNo'))
    expect(uniqueIndexName('bp-a', 'Part', 'partNo')).not.toBe(
      uniqueIndexName('bp-b', 'Part', 'partNo'),
    )
    expect(uniqueIndexName('bp-a', 'Part', 'partNo')).not.toBe(
      uniqueIndexName('bp-a', 'Supplier', 'partNo'),
    )
  })
})

describe('applyUniqueIndexes（P1 装载时应用）', () => {
  it('有冲突 → 返回清单且不发 CREATE INDEX', async () => {
    const query = jest.fn(async () => [
      { value: 'P-1', organizationId: 'org-1', ids: ['a', 'b'] },
    ])
    const conflicts = await applyUniqueIndexes({ query }, BLUEPRINT_ID, SEMANTIC)
    expect(conflicts).toEqual([
      { entity: 'Part', field: 'partNo', value: 'P-1', organizationId: 'org-1', ids: ['a', 'b'] },
    ])
    expect(
      query.mock.calls.some((call) => String((call as unknown[])[0]).includes('CREATE UNIQUE INDEX')),
    ).toBe(false)
  })

  it('无冲突 → 发出 CREATE UNIQUE INDEX IF NOT EXISTS', async () => {
    const query = jest.fn(async () => [])
    expect(await applyUniqueIndexes({ query }, BLUEPRINT_ID, SEMANTIC)).toEqual([])
    expect(
      query.mock.calls.some((call) => String((call as unknown[])[0]).includes('CREATE UNIQUE INDEX')),
    ).toBe(true)
  })
})
