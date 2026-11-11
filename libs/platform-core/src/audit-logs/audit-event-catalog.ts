/**
 * 审计事件目录：action 的必填字段、资源类型与保留期类别。
 *
 * 已知 action 缺必填字段必须拒绝；未知 action 标 `source=custom` 并告警，
 * 不能静默当成普通日志。
 */

export type AuditRetentionClass = 'short' | 'standard' | 'long' | 'legal'

export interface AuditEventDefinition {
  action: string
  resource: string
  requiredFields: string[]
  retentionClass: AuditRetentionClass
  highRisk?: boolean
}

const def = (
  action: string,
  resource: string,
  requiredFields: string[],
  retentionClass: AuditRetentionClass = 'standard',
  highRisk = false,
): AuditEventDefinition => ({ action, resource, requiredFields, retentionClass, highRisk })

export const AUDIT_EVENT_CATALOG: AuditEventDefinition[] = [
  def('auth.login', 'session', ['actor'], 'standard'),
  def('auth.login.failed', 'session', ['actor'], 'long', true),
  def('auth.logout', 'session', ['actor'], 'short'),
  def('auth.session.revoked', 'session', ['actor'], 'long', true),
  def('auth.service_token.issued', 'service_client', ['actor', 'resourceId'], 'long', true),
  def('role.created', 'role', ['actor', 'resourceId'], 'long'),
  def('role.updated', 'role', ['actor', 'resourceId'], 'long'),
  def('role.deleted', 'role', ['actor', 'resourceId'], 'long', true),
  def('permission.changed', 'permission', ['actor', 'resourceId'], 'long', true),
  def('menu.changed', 'menu', ['actor'], 'standard'),
  def('release.publish', 'release', ['actor', 'resourceId'], 'long', true),
  def('release.activate', 'release', ['actor', 'resourceId'], 'long', true),
  def('release.rollback', 'release', ['actor', 'resourceId'], 'long', true),
  def('review.approve', 'approval', ['actor', 'resourceId'], 'long'),
  def('review.reject', 'approval', ['actor', 'resourceId'], 'long'),
  def('review.request_changes', 'approval', ['actor', 'resourceId'], 'long'),
  def('announcement.publish', 'announcement', ['actor', 'resourceId'], 'standard'),
  def('announcement.withdraw', 'announcement', ['actor', 'resourceId'], 'standard'),
  def('data.import', 'record', ['actor'], 'standard'),
  def('data.export', 'record', ['actor'], 'long', true),
  def('settings.update', 'settings', ['actor'], 'long'),
  def('ai.generate', 'ai_module', ['actor'], 'standard'),
  def('ai.model.call', 'ai_model', ['actor'], 'standard'),
  def('ai.content.review', 'content', ['actor'], 'long', true),
  def('ai.provenance', 'content', ['actor'], 'long'),
  def('ai.label.apply', 'content', ['actor'], 'long', true),
  def('ai.label.verify', 'content', ['actor'], 'long'),
  def('ai.review.submit', 'content', ['actor'], 'long', true),
  def('ai.score', 'score', ['actor'], 'long'),
  def('ai.score.confirm', 'score', ['actor'], 'long', true),
  def('ai.score.appeal', 'score', ['actor'], 'long', true),
  def('ai.score.final', 'score', ['actor'], 'long', true),
  def('integration.sync', 'connector', ['actor'], 'standard'),
  def('connector.changed', 'connector', ['actor'], 'long', true),
  def('audit.query', 'audit_log', ['actor'], 'standard'),
  def('audit.export', 'audit_log', ['actor'], 'long', true),
  def('audit.verify', 'audit_log', ['actor'], 'long'),
  def('audit.break_glass', 'audit_log', ['actor'], 'legal', true),
  def('audit.checkpoint', 'audit_log', ['actor'], 'long'),
  def('audit.archive', 'audit_log', ['actor'], 'long', true),
  def('audit.restore', 'audit_log', ['actor'], 'legal', true),
  def('audit.legal_hold', 'audit_log', ['actor', 'resourceId'], 'legal', true),
  def('record.clone', 'record', ['actor'], 'standard'),
  def('record.move', 'record', ['actor'], 'standard'),
  def('record.reorder', 'record', ['actor'], 'standard'),
  def('record.archive', 'record', ['actor'], 'long'),
  def('record.restore', 'record', ['actor'], 'long'),
  def('record.snapshot', 'record', ['actor'], 'standard'),
  def('record.snapshot.publish', 'record', ['actor'], 'long'),
  def('record.snapshot.restore', 'record', ['actor'], 'long'),
  def('offline.package.create', 'offline_package', ['actor'], 'long'),
  def('offline.package.publish', 'offline_package', ['actor'], 'long'),
  def('offline.package.revoke', 'offline_package', ['actor'], 'long', true),
  def('offline.device.revoke', 'offline_device', ['actor'], 'long', true),
  def('offline.entitlement.grant', 'offline_entitlement', ['actor'], 'long'),
  def('offline.entitlement.revoke', 'offline_entitlement', ['actor'], 'long', true),
  def('offline.cleanup', 'offline_entitlement', ['actor'], 'long'),
  def('document.run', 'document', ['actor'], 'long'),
  def('document.edit', 'document', ['actor'], 'long'),
  def('document.convert', 'document', ['actor'], 'long', true),
]

const BY_ACTION = new Map(AUDIT_EVENT_CATALOG.map((item) => [item.action, item]))

export function auditEventDefinition(action: string): AuditEventDefinition | null {
  return BY_ACTION.get(action) ?? null
}

const RETENTION_DAYS: Record<AuditRetentionClass, number | null> = {
  short: 30,
  standard: 180,
  long: 3650,
  legal: null,
}

export function resolveRetentionUntil(
  retentionClass: AuditRetentionClass,
  now: Date = new Date(),
): Date | null {
  const days = RETENTION_DAYS[retentionClass]
  if (days === null) return null
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

export interface AuditEventValidation {
  definition: AuditEventDefinition | null
  unknown: boolean
  missing: string[]
}

export function validateAuditEvent(input: {
  action: string
  actor?: string | null
  resourceId?: string | null
}): AuditEventValidation {
  const definition = auditEventDefinition(input.action)
  if (!definition) return { definition: null, unknown: true, missing: [] }
  const values: Record<string, unknown> = {
    actor: input.actor,
    resourceId: input.resourceId,
  }
  const missing = definition.requiredFields.filter((field) => !values[field])
  return { definition, unknown: false, missing }
}
