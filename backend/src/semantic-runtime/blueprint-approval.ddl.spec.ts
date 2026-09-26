import { BLUEPRINT_APPROVALS_DDL } from './blueprint-approval.ddl'
import { BLUEPRINT_JOURNAL_ENTRIES_DDL } from './blueprint-journal-entry.ddl'

describe('判定执行 DDL 常量', () => {
  it('审批表：唯一约束 + TypeORM 外键哈希', () => {
    const joined = BLUEPRINT_APPROVALS_DDL.join('\n')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS public.blueprint_approvals')
    expect(joined).toContain('PK_baacb6e4c79d82f88ebcc5807f7')
    expect(joined).toContain('UQ_2d647c4c3aba8401909305918b1')
    expect(joined).toContain('FK_072c93b172cbcc9c5c3fc539792')
    expect(joined).toContain('UNIQUE ("recordId", "ruleId", "stepIndex")')
  })

  it('分录表：bigint 小单位 + 防重复过账唯一约束', () => {
    const joined = BLUEPRINT_JOURNAL_ENTRIES_DDL.join('\n')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS public.blueprint_journal_entries')
    expect(joined).toContain('"amountUnits" bigint')
    expect(joined).toContain('UQ_cabe470d13abf1ab79840147daf')
    expect(joined).toContain('FK_5202c3ad4ea898ae6649a4f0f84')
    expect(joined).not.toContain('numeric')
    expect(joined).not.toContain('double precision')
  })
})
