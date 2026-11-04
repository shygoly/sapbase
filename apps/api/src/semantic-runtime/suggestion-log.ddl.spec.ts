import { SUGGESTION_LOG_DDL } from './suggestion-log.ddl'

describe('建议日志 DDL 常量', () => {
  it('表：主键、组织外键、blueprintId/entity/recordId 索引用 TypeORM 哈希', () => {
    const joined = SUGGESTION_LOG_DDL.join('\n')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS public.blueprint_suggestion_logs')
    expect(joined).toContain('PK_606cd71e8e42233e7cbd0d032ec')
    expect(joined).toContain('FK_88a3056b00cc91c66ab54a7fe05')
    expect(joined).toContain('IDX_643163585d4666a25396508f3a')
    expect(joined).toContain('"suggestedToState" character varying(255) NOT NULL')
  })

  it('负例：DDL 不是第二份建表语句', () => {
    const creates = SUGGESTION_LOG_DDL.filter((sql) => /CREATE TABLE/i.test(sql))
    expect(creates).toHaveLength(1)
    expect(creates[0]).not.toContain('workflow_auto_suggestion_logs')
  })
})
