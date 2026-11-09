import { compileScopeExpr } from './scope-sql-compiler'

describe('compileScopeExpr', () => {
  const base = { alias: 'r', organizationId: 'org-1', actorId: 'u1' }

  it('all / none', () => {
    expect(compileScopeExpr({ op: 'all' }, base)).toEqual({ sql: '1=1', params: [] })
    expect(compileScopeExpr({ op: 'none' }, base)).toEqual({ sql: '1=0', params: [] })
  })

  it('column eq actor', () => {
    const compiled = compileScopeExpr(
      {
        op: 'eq',
        field: { kind: 'column', column: 'ownerId' },
        value: { kind: 'actor' },
      },
      base,
    )
    expect(compiled.sql).toBe('"r"."ownerId" = $1')
    expect(compiled.params).toEqual(['u1'])
  })

  it('jsonb in literals', () => {
    const compiled = compileScopeExpr(
      {
        op: 'in',
        field: { kind: 'jsonb', column: 'data', path: 'classId' },
        values: [
          { kind: 'literal', value: 'c1' },
          { kind: 'literal', value: 'c2' },
        ],
      },
      { ...base, alias: 'br' },
    )
    expect(compiled.sql).toBe(`"br"."data"->>'classId' IN ($1, $2)`)
    expect(compiled.params).toEqual(['c1', 'c2'])
  })

  it('exists entity 带 entity/组织过滤，row 引用外层别名', () => {
    const compiled = compileScopeExpr(
      {
        op: 'exists',
        source: { kind: 'entity', name: 'TeachingAssignment' },
        where: {
          op: 'and',
          args: [
            {
              op: 'eq',
              field: { kind: 'jsonb', column: 'data', path: 'courseId' },
              value: { kind: 'row', field: 'id' },
            },
            {
              op: 'eq',
              field: { kind: 'jsonb', column: 'data', path: 'teacherId' },
              value: { kind: 'actor' },
            },
          ],
        },
      },
      { ...base, alias: 'br', rowAlias: 'br' },
    )
    expect(compiled.sql).toContain('EXISTS (SELECT 1 FROM "public"."blueprint_records" "ds_exists_1"')
    expect(compiled.sql).toContain('"ds_exists_1".entity = $1')
    expect(compiled.sql).toContain('"ds_exists_1"."organizationId" = $2')
    expect(compiled.sql).toContain('"ds_exists_1"."data"->>\'courseId\' = "br"."id"')
    expect(compiled.sql).toContain('"ds_exists_1"."data"->>\'teacherId\' = $3')
    expect(compiled.params).toEqual(['TeachingAssignment', 'org-1', 'u1'])
  })

  it('and/or/not 组合', () => {
    const compiled = compileScopeExpr(
      {
        op: 'and',
        args: [
          { op: 'all' },
          {
            op: 'or',
            args: [
              {
                op: 'eq',
                field: { kind: 'column', column: 'a' },
                value: { kind: 'literal', value: 1 },
              },
              {
                op: 'not',
                arg: {
                  op: 'eq',
                  field: { kind: 'column', column: 'b' },
                  value: { kind: 'literal', value: 2 },
                },
              },
            ],
          },
        ],
      },
      base,
    )
    expect(compiled.sql).toBe('("r"."a" = $1 OR NOT ("r"."b" = $2))')
    expect(compiled.params).toEqual([1, 2])
  })

  it('拒绝非法标识符', () => {
    expect(() =>
      compileScopeExpr(
        {
          op: 'eq',
          field: { kind: 'column', column: 'x"; DROP TABLE users; --' },
          value: { kind: 'literal', value: 1 },
        },
        base,
      ),
    ).toThrow(/非法 SQL 标识符/)
  })
})
