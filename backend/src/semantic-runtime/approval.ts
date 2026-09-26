/**
 * 审批链的纯判定：建链、当前待审步骤、推进。不碰 IO。
 *
 * "待审"不是模板状态名，而是链上存在 pending 步骤。
 */

export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected'

export interface ApprovalStepDecl {
  role: string
}

export interface ApprovalRuleDecl {
  id: string
  entity: string
  when: string
  steps: ApprovalStepDecl[]
}

export interface ApprovalStepState {
  index: number
  role: string
  status: ApprovalStepStatus
  actor?: string
  decidedAt?: string | null
}

export interface ApprovalChainView {
  ruleId: string
  status: ApprovalStepStatus
  steps: ApprovalStepState[]
}

export type ApproveResult =
  | { ok: true; steps: ApprovalStepState[]; chainStatus: ApprovalStepStatus }
  | {
      ok: false
      reason: 'role-mismatch' | 'already-approved' | 'already-rejected' | 'not-found'
      expectedRole?: string
      actualRole?: string
    }

export function buildPendingSteps(rule: ApprovalRuleDecl): ApprovalStepState[] {
  return rule.steps.map((step, index) => ({
    index,
    role: step.role,
    status: 'pending' as const,
  }))
}

export function chainStatusOf(steps: ApprovalStepState[]): ApprovalStepStatus {
  if (steps.length === 0) return 'pending'
  if (steps.some((step) => step.status === 'rejected')) return 'rejected'
  if (steps.every((step) => step.status === 'approved')) return 'approved'
  return 'pending'
}

export function isFullyApproved(steps: ApprovalStepState[]): boolean {
  return steps.length > 0 && chainStatusOf(steps) === 'approved'
}

export function currentPendingStep(steps: ApprovalStepState[]): ApprovalStepState | undefined {
  return [...steps].sort((a, b) => a.index - b.index).find((step) => step.status === 'pending')
}

export function toChainView(ruleId: string, steps: ApprovalStepState[]): ApprovalChainView {
  return { ruleId, status: chainStatusOf(steps), steps }
}

export function applyApprove(
  steps: ApprovalStepState[],
  role: string,
  actor: string,
  decidedAt: string,
): ApproveResult {
  if (steps.length === 0) {
    return { ok: false, reason: 'not-found' }
  }
  const status = chainStatusOf(steps)
  if (status === 'approved') return { ok: false, reason: 'already-approved' }
  if (status === 'rejected') return { ok: false, reason: 'already-rejected' }

  const pending = currentPendingStep(steps)
  if (!pending) return { ok: false, reason: 'already-approved' }
  if (pending.role !== role) {
    return {
      ok: false,
      reason: 'role-mismatch',
      expectedRole: pending.role,
      actualRole: role,
    }
  }

  const next = steps.map((step) =>
    step.index === pending.index
      ? { ...step, status: 'approved' as const, actor, decidedAt }
      : { ...step },
  )
  return { ok: true, steps: next, chainStatus: chainStatusOf(next) }
}
