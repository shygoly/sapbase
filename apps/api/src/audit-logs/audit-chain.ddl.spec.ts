import { AUDIT_CHAIN_DDL } from '@sap/platform-core/audit-logs/audit-chain.ddl'

describe('audit chain DDL', () => {
  const joined = AUDIT_CHAIN_DDL.join('\n')

  it('扩展 audit_logs 链字段', () => {
    for (const column of ['seq', 'hash', 'payload', 'ip', 'source']) {
      expect(joined).toContain(`ADD COLUMN IF NOT EXISTS ${column}`)
    }
    for (const column of [
      'prevHash',
      'hashAlgo',
      'actorType',
      'appInstallationId',
      'userAgent',
      'correlationId',
      'retentionUntil',
      'legalHold',
      'archivedAt',
    ]) {
      expect(joined).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`)
    }
  })

  it('legacy 行标记 + 唯一 seq + checkpoint/archive 表', () => {
    expect(joined).toContain(`SET hash = 'legacy'`)
    expect(joined).toContain('UQ_audit_log_org_seq')
    expect(joined).toContain('trg_audit_logs_append_only')
    expect(joined).toContain('prevent_audit_mutation')
    expect(joined).toContain('app.audit_break_glass')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS public.audit_checkpoints')
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS public.audit_archives')
  })
})
