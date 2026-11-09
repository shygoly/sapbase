import { createHash } from 'node:crypto'

export interface AuditChainInput {
  organizationId: string
  action: string
  resource: string
  actor: string
  actorType?: string
  status: 'success' | 'failure' | 'pending'
  resourceId?: string | null
  changes?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  appInstallationId?: string | null
  ip?: string | null
  userAgent?: string | null
  correlationId?: string | null
  source?: string | null
  timestamp?: Date
  retentionUntil?: Date | null
  legalHold?: boolean
}

export interface AuditHashPayload {
  organizationId: string
  seq: number
  action: string
  resource: string
  actor: string
  actorType: string
  status: string
  resourceId: string | null
  changes: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  appInstallationId: string | null
  ip: string | null
  userAgent: string | null
  correlationId: string | null
  source: string | null
  timestamp: string
}

/** 稳定 JSON：对象键递归排序，保证同一逻辑事件得到同一字节。 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

export function canonicalAuditPayload(payload: AuditHashPayload): string {
  return stableStringify(payload)
}

export function computeAuditHash(prevHash: string, payload: string): string {
  return createHash('sha256').update(`${prevHash}\n${payload}`).digest('hex')
}

export function buildAuditHashPayload(
  input: AuditChainInput,
  seq: number,
  timestamp: Date,
): AuditHashPayload {
  return {
    organizationId: input.organizationId,
    seq,
    action: input.action,
    resource: input.resource,
    actor: input.actor,
    actorType: input.actorType ?? 'user',
    status: input.status,
    resourceId: input.resourceId ?? null,
    changes: input.changes ?? null,
    metadata: input.metadata ?? null,
    appInstallationId: input.appInstallationId ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    correlationId: input.correlationId ?? null,
    source: input.source ?? null,
    timestamp: timestamp.toISOString(),
  }
}
