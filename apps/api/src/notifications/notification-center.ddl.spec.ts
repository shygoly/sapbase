import { NOTIFICATION_CENTER_DDL } from './notification-center.ddl'

describe('notification center DDL', () => {
  const joined = NOTIFICATION_CENTER_DDL.join('\n')

  it('扩展 notifications 字段', () => {
    expect(joined).toContain('ADD COLUMN IF NOT EXISTS category')
    expect(joined).toContain('ADD COLUMN IF NOT EXISTS priority')
    expect(joined).toContain('ADD COLUMN IF NOT EXISTS mandatory')
    for (const column of ['actionUrl', 'expiresAt', 'readAt']) {
      expect(joined).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`)
    }
  })

  it('创建偏好/公告/受众/投递表', () => {
    for (const table of [
      'notification_preferences',
      'announcements',
      'announcement_audiences',
      'announcement_deliveries',
    ]) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
    }
    expect(joined).toContain('UQ_notification_pref_org_user_category')
    expect(joined).toContain('UQ_announcement_delivery')
  })
})
