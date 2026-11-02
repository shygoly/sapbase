export interface ProposalShape {
  diff: Record<string, unknown>
  evidence?: unknown[]
  risk?: Record<string, unknown>
  testPlan?: Record<string, unknown>
  rollbackPlan?: Record<string, unknown>
}

export function assertProposalHardRequirements(input: ProposalShape): void {
  if (!input.evidence || input.evidence.length === 0) throw new Error('????????????feedback/metric/error?')
  if (!input.diff || typeof input.diff !== 'object') throw new Error('???????? diff')
  const risk = input.risk ?? {}
  for (const key of ['breaking', 'permissionChange', 'migration', 'agentBehaviorChange']) {
    if (typeof risk[key] !== 'boolean') throw new Error(`risk.${key} ??? boolean`)
  }
  if (!input.testPlan || Object.keys(input.testPlan).length === 0) throw new Error('?????????')
  if (!input.rollbackPlan || !input.rollbackPlan.strategy) throw new Error('???????????')
}

export function assertApproverDistinct(input: { createdBy?: string | null; createdByAgent?: string | null; approverId: string }): void {
  if (input.createdBy && input.createdBy === input.approverId) throw new Error('???????????')
  if (input.createdByAgent && input.createdByAgent === input.approverId) throw new Error('????????????')
}

export function needsSecondApprover(risk: Record<string, unknown>): boolean {
  return risk.permissionChange === true || risk.migration === true || risk.agentBehaviorChange === true
}
