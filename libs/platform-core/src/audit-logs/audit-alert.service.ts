import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

export interface AuditAlert {
  type:
    | 'login-failures'
    | 'break-glass'
    | 'verification-failure'
    | 'large-export'
    | 'permission-change'
  severity: 'warning' | 'critical'
  count: number
  windowMinutes: number
  message: string
}

/**
 * 审计异常检测：只读聚合，不复制审计真源。
 * 阈值可按环境覆盖；命中结果供 Console 告警与外部通知消费。
 */
@Injectable()
export class AuditAlertService {
  constructor(private readonly dataSource: DataSource) {}

  async evaluate(
    organizationId: string,
    windowMinutes = 24 * 60,
  ): Promise<{ windowMinutes: number; alerts: AuditAlert[] }> {
    const rows = (await this.dataSource.query(
      `SELECT action, count(*)::int AS count
         FROM public.audit_logs
        WHERE "organizationId" = $1
          AND timestamp >= now() - ($2 || ' minutes')::interval
        GROUP BY action`,
      [organizationId, String(windowMinutes)],
    )) as Array<{ action: string; count: number }>
    const countOf = (action: string) => rows.find((row) => row.action === action)?.count ?? 0
    const threshold = (name: string, fallback: number) =>
      Number(process.env[name] ?? fallback)

    const alerts: AuditAlert[] = []
    const loginFailures = countOf('auth.login.failed')
    if (loginFailures >= threshold('AUDIT_ALERT_LOGIN_FAILURES', 10)) {
      alerts.push({
        type: 'login-failures',
        severity: 'warning',
        count: loginFailures,
        windowMinutes,
        message: `登录失败 ${loginFailures} 次`,
      })
    }
    const breakGlass = countOf('audit.break_glass')
    if (breakGlass > 0) {
      alerts.push({
        type: 'break-glass',
        severity: 'critical',
        count: breakGlass,
        windowMinutes,
        message: `break-glass 操作 ${breakGlass} 次`,
      })
    }
    const failedVerify = (await this.dataSource.query(
      `SELECT count(*)::int AS count FROM public.audit_logs
        WHERE "organizationId" = $1 AND action = 'audit.verify' AND status = 'failure'
          AND timestamp >= now() - ($2 || ' minutes')::interval`,
      [organizationId, String(windowMinutes)],
    )) as Array<{ count: number }>
    if (Number(failedVerify[0]?.count ?? 0) > 0) {
      alerts.push({
        type: 'verification-failure',
        severity: 'critical',
        count: Number(failedVerify[0].count),
        windowMinutes,
        message: '审计链验证失败',
      })
    }
    const largeExports = (await this.dataSource.query(
      `SELECT count(*)::int AS count FROM public.audit_logs
        WHERE "organizationId" = $1 AND action = 'audit.export'
          AND (metadata->>'rows')::int >= $2
          AND timestamp >= now() - ($3 || ' minutes')::interval`,
      [organizationId, threshold('AUDIT_ALERT_EXPORT_ROWS', 1000), String(windowMinutes)],
    )) as Array<{ count: number }>
    if (Number(largeExports[0]?.count ?? 0) > 0) {
      alerts.push({
        type: 'large-export',
        severity: 'warning',
        count: Number(largeExports[0].count),
        windowMinutes,
        message: '大批量审计导出',
      })
    }
    const permissionChanges =
      countOf('permission.changed') +
      countOf('role.created') +
      countOf('role.updated') +
      countOf('role.deleted')
    if (permissionChanges > 0) {
      alerts.push({
        type: 'permission-change',
        severity: 'warning',
        count: permissionChanges,
        windowMinutes,
        message: `权限/角色变更 ${permissionChanges} 次`,
      })
    }
    return { windowMinutes, alerts }
  }
}
