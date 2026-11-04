import {
  filterSql,
  hasQueryParams,
  parseRecordQuery,
  sortSqlExpression,
} from './record-query'
import { RecordWriteError } from './record-write-error'
import type { SemanticEntity } from './record-validator'

const ENTITY: SemanticEntity = {
  name: 'SalesOrder',
  fields: [
    { name: 'customer', type: 'reference', reference: 'Customer' },
    { name: 'quantity', type: 'number' },
    { name: 'number', type: 'text' },
  ],
  states: [
    { name: 'draft', initial: true },
    { name: 'confirmed' },
    { name: 'shipped', final: true },
  ],
}

describe('hasQueryParams / 两种响应形状的判定', () => {
  it('没有任何查询参数 → 裸数组路径', () => {
    expect(hasQueryParams(undefined)).toBe(false)
    expect(hasQueryParams({})).toBe(false)
  })

  it('带了任一查询参数 → 信封路径', () => {
    expect(hasQueryParams({ page: '1' })).toBe(true)
    expect(hasQueryParams({ filter: '{"customer":"x"}' })).toBe(true)
  })
})

describe('parseRecordQuery 判据（不过即拒、不静默忽略）', () => {
  it('正例：合法分页 / 排序 / 过滤 / 状态', () => {
    expect(
      parseRecordQuery(ENTITY, {
        page: '2',
        pageSize: '10',
        sort: 'number',
        order: 'desc',
        state: 'draft',
        filter: '{"customer":"c1"}',
      }),
    ).toEqual({
      page: 2,
      pageSize: 10,
      sort: 'number',
      order: 'desc',
      state: 'draft',
      filter: { customer: 'c1' },
    })
  })

  it('负例：未声明的过滤字段被拒并指明', () => {
    expect(() => parseRecordQuery(ENTITY, { filter: '{"foo":"1"}' })).toThrow(RecordWriteError)
    try {
      parseRecordQuery(ENTITY, { filter: '{"foo":"1"}' })
    } catch (error) {
      expect(error).toMatchObject({ reason: 'unknown-field', field: 'foo' })
      expect((error as Error).message).toMatch(/未被实体 SalesOrder 声明/)
    }
  })

  it('负例：sort / state / page / pageSize 非法', () => {
    expect(() => parseRecordQuery(ENTITY, { sort: 'ghost' })).toThrow(/未被实体 SalesOrder 声明/)
    expect(() => parseRecordQuery(ENTITY, { state: 'ghost' })).toThrow(/未被实体 SalesOrder 声明/)
    expect(() => parseRecordQuery(ENTITY, { page: '0' })).toThrow(/正整数/)
    expect(() => parseRecordQuery(ENTITY, { pageSize: '101' })).toThrow(/超出范围/)
    expect(() => parseRecordQuery(ENTITY, { order: 'sideways' })).toThrow(/asc 或 desc/)
  })
})

describe('sortSqlExpression / filterSql', () => {
  it('number 字段 ::numeric，其余文本；createdAt 用列', () => {
    expect(sortSqlExpression(ENTITY, 'quantity')).toBe(`(data->>'quantity')::numeric`)
    expect(sortSqlExpression(ENTITY, 'number')).toBe(`data->>'number'`)
    expect(sortSqlExpression(ENTITY, 'createdAt')).toBe('"createdAt"')
  })

  it('过滤参数化，不拼接值', () => {
    const built = filterSql(ENTITY, { customer: 'abc', quantity: 3 }, 4)
    expect(built.clause).toContain('$4')
    expect(built.clause).toContain('$5')
    expect(built.params).toEqual(['abc', '3'])
    expect(built.nextIndex).toBe(6)
  })
})
