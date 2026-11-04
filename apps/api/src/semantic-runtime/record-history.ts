/**
 * 迁移历史与建议迁移的纯组装：审计行 / 模板声明 → 读接口结果。
 * 不碰 IO；调用方负责授权门、租户过滤，以及保证建议迁移只读。
 */

export const TRANSITION_AUDIT_ACTION = 'blueprint.record.transition'
export const TRANSITION_AUDIT_SOURCE_BLUEPRINT = 'blueprint'
export const TRANSITION_AUDIT_SOURCE_LEGACY = 'legacy-workflow'
export const LEGACY_TRANSITION_AUDIT_ACTION = 'workflow.instance.transition'
export const LEGACY_START_AUDIT_ACTION = 'workflow.instance.start'

export interface TransitionHistoryItem {
  at: string
  actor: string
  from: string
  to: string
}

export interface TransitionAuditRow {
  timestamp: Date | string
  actor?: string | null
  changes?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export interface SuggestedTransitionItem {
  to: string
  requiresApproval: boolean
  pendingApproval?: { ruleId: string; role: string }
}

export interface ApprovalJudgement {
  ruleId: string
  applies: boolean
  fullyApproved: boolean
  pendingRole?: string
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function timeOf(value: Date | string | number | undefined): number {
  if (value === undefined) return 0
  const at = new Date(value).getTime()
  return Number.isFinite(at) ? at : 0
}

function pickFromTo(row: TransitionAuditRow): { from: string; to: string } | null {
  const from = asText(row.changes?.from) ?? asText(row.metadata?.from)
  const to = asText(row.changes?.to) ?? asText(row.metadata?.to)
  if (from == null || to == null) return null
  return { from, to }
}

/** 审计行 → 按时间升序的 `{ at, actor, from, to }`；缺 from/to 的行丢弃，不编。 */
export function assembleTransitionHistory(rows: TransitionAuditRow[]): TransitionHistoryItem[] {
  return [...rows]
    .sort((left, right) => timeOf(left.timestamp) - timeOf(right.timestamp))
    .flatMap((row) => {
      const pair = pickFromTo(row)
      if (!pair) return []
      return [
        {
          at: new Date(row.timestamp).toISOString(),
          actor: row.actor && row.actor.length > 0 ? row.actor : 'unknown',
          from: pair.from,
          to: pair.to,
        },
      ]
    })
}

/**
 * 当前状态的合法目标 + 已求值的审批判定 → 建议迁移。
 * 审批是实体级（复用既有 when / 链），不是按目标各写一套。
 */
export function assembleSuggestedTransitions(
  allowedTargets: string[],
  judgements: ApprovalJudgement[],
): SuggestedTransitionItem[] {
  const pending = judgements.find((item) => item.applies && !item.fullyApproved)
  return allowedTargets.map((to) => {
    if (!pending) return { to, requiresApproval: false }
    return {
      to,
      requiresApproval: true,
      pendingApproval: {
        ruleId: pending.ruleId,
        role: pending.pendingRole ?? '',
      },
    }
  })
}

/** 旧 `workflow_history` 行 → `(from, to)`，供对拍归一化。 */
export function normalizeLegacyHistory(
  rows: Array<{ fromState?: string | null; toState: string; timestamp?: Date | string }>,
): Array<{ from: string; to: string }> {
  return [...rows]
    .sort((left, right) => timeOf(left.timestamp) - timeOf(right.timestamp))
    .map((row) => ({ from: row.fromState ?? '', to: row.toState }))
}
