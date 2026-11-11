import { AuditAlertService } from '@sap/platform-core/audit-logs/audit-alert.service'

describe('AuditAlertService', () => {
  it('登录失败/break-glass/验证失败/大批量导出/权限变更触发告警', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('GROUP BY action')) {
        return [
          { action: 'auth.login.failed', count: 12 },
          { action: 'audit.break_glass', count: 1 },
          { action: 'audit.export', count: 2 },
          { action: 'permission.changed', count: 1 },
          { action: 'role.updated', count: 1 },
        ]
      }
      if (sql.includes("action = 'audit.verify'")) return [{ count: 1 }]
      if (sql.includes("action = 'audit.export'")) return [{ count: 1 }]
      return []
    })
    const service = new AuditAlertService({ query } as never)
    const result = await service.evaluate('org-1', 1440)
    expect(result.alerts.map((item: { type: string }) => item.type).sort()).toEqual(
      ['break-glass', 'large-export', 'login-failures', 'permission-change', 'verification-failure'].sort(),
    )
    expect(result.windowMinutes).toBe(1440)
  })

  it('无异常不产生告警', async () => {
    const query = jest.fn(async () => [])
    const result = await new AuditAlertService({ query } as never).evaluate('org-1')
    expect(result.alerts).toEqual([])
  })
})
