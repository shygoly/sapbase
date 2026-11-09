export type AssigneeSelector =
  | { kind: 'role'; role: string }
  | { kind: 'user'; userId: string }
  | { kind: 'position'; positionKey: string; dimension?: string; anchor?: 'record' }
  | { kind: 'creator' }

export interface AssigneeActor {
  userId: string
  roleKeys?: readonly string[]
  positionKeys?: readonly string[]
}

export interface RecordAnchorContext {
  creatorId?: string | null
  data?: Record<string, unknown>
}

export function selectorMatchesActor(
  selector: AssigneeSelector,
  actor: AssigneeActor,
  record?: RecordAnchorContext,
): boolean {
  switch (selector.kind) {
    case 'role':
      return actor.roleKeys?.includes(selector.role) === true
    case 'user':
      return selector.userId === actor.userId
    case 'position':
      return actor.positionKeys?.includes(selector.positionKey) === true
    case 'creator':
      return Boolean(record?.creatorId) && record?.creatorId === actor.userId
    default:
      return false
  }
}

export function normalizeSelector(value: unknown): AssigneeSelector | null {
  if (!value || typeof value !== 'object') return null
  const selector = value as Record<string, unknown>
  if (selector.kind === 'role' && typeof selector.role === 'string') {
    return { kind: 'role', role: selector.role }
  }
  if (selector.kind === 'user' && typeof selector.userId === 'string') {
    return { kind: 'user', userId: selector.userId }
  }
  if (selector.kind === 'position' && typeof selector.positionKey === 'string') {
    return {
      kind: 'position',
      positionKey: selector.positionKey,
      dimension: typeof selector.dimension === 'string' ? selector.dimension : undefined,
      anchor: selector.anchor === 'record' ? 'record' : undefined,
    }
  }
  if (selector.kind === 'creator') return { kind: 'creator' }
  return null
}
