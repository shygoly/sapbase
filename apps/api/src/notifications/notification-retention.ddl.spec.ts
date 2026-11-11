import { NOTIFICATION_RETENTION_DDL } from './notification-retention.ddl'

describe('notification retention DDL', () => {
  const joined = NOTIFICATION_RETENTION_DDL.join('\n')

  it('软删除与保留期字段', () => {
    expect(joined).toContain('notifications\n     ADD COLUMN IF NOT EXISTS "deletedAt"')
    for (const column of ['retentionDays', 'deletedAt']) {
      expect(joined).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`)
    }
    expect(joined).toContain('ADD COLUMN IF NOT EXISTS attachments jsonb')
    expect(joined).toContain('announcement_deliveries\n     ADD COLUMN IF NOT EXISTS "deletedAt"')
  })

  it('清理运行审计表', () => {
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS public.notification_cleanup_runs')
    expect(joined).toContain('"notificationRetentionDays"')
    expect(joined).toContain('"notificationsDeleted"')
  })
})
