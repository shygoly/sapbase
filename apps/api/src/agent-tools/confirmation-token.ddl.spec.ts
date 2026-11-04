import { AGENT_CONFIRMATION_TOKENS_DDL } from './confirmation-token.ddl'

describe('agent confirmation token DDL', () => {
  it('支持历史 tenant-only 令牌，并为应用化令牌添加列、索引和条件外键', () => {
    const joined = AGENT_CONFIRMATION_TOKENS_DDL.join('\n')
    expect(joined).toContain('"appInstallationId" uuid')
    expect(joined).toContain('ADD COLUMN IF NOT EXISTS "appInstallationId" uuid')
    expect(joined).toContain(
      'FOREIGN KEY ("appInstallationId") REFERENCES public.app_installations(id)',
    )
    expect(joined).toContain(
      `to_regclass('public.app_installations') IS NOT NULL`,
    )
  })
})
