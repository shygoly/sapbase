export interface ProposalShape {
  diff: Record<string, unknown>
  evidence?: unknown[]
  risk?: Record<string, unknown>
  testPlan?: Record<string, unknown>
  rollbackPlan?: Record<string, unknown>
}

export function assertProposalHardRequirements(input: ProposalShape): void {
  if (!input.evidence || input.evidence.length === 0) throw new Error('提议必须至少附一条证据（feedback / metric / error）')
  if (!input.diff || typeof input.diff !== 'object') throw new Error('提议必须包含结构化 diff')
  const risk = input.risk ?? {}
  for (const key of ['breaking', 'permissionChange', 'migration', 'agentBehaviorChange']) {
    if (typeof risk[key] !== 'boolean') throw new Error(`risk.${key} 必须是 boolean`)
  }
  if (!input.testPlan || Object.keys(input.testPlan).length === 0) throw new Error('提议必须包含测试计划')
  if (!input.rollbackPlan || !input.rollbackPlan.strategy) throw new Error('提议必须包含回退计划（strategy）')
}

export function assertApproverDistinct(input: { createdBy?: string | null; createdByAgent?: string | null; approverId: string }): void {
  if (input.createdBy && input.createdBy === input.approverId) throw new Error('作者不能批准自己起草的提议')
  if (input.createdByAgent && input.createdByAgent === input.approverId) throw new Error('智能体不能批准自己起草的提议')
}

export function needsSecondApprover(risk: Record<string, unknown>): boolean {
  return risk.permissionChange === true || risk.migration === true || risk.agentBehaviorChange === true
}
