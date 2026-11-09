import { REVIEW_APPROVAL_DDL } from './review.ddl'

describe('review/approval DDL', () => {
  const joined = REVIEW_APPROVAL_DDL.join('\n')

  it('扩展 blueprint_approvals 并替换唯一键', () => {
    expect(joined).toContain('ADD COLUMN IF NOT EXISTS round')
    expect(joined).toContain('ADD COLUMN IF NOT EXISTS kind')
    for (const column of ['selector', 'assignee', 'comment']) {
      expect(joined).toContain(`ADD COLUMN IF NOT EXISTS ${column}`)
    }
    for (const column of ['checkProvider', 'checkResult', 'decidedBy', 'dueAt']) {
      expect(joined).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`)
    }
    expect(joined).toContain('UQ_blueprint_approval_record_rule_round_step')
    expect(joined).toContain('DROP CONSTRAINT IF EXISTS "UQ_2d647c4c3aba8401909305918b1"')
  })

  it('新增评论/事件/委托/工作项', () => {
    for (const table of ['review_comments', 'review_events', 'review_delegations', 'work_items']) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
    }
    expect(joined).toContain('UQ_work_item_org_source')
  })
})
