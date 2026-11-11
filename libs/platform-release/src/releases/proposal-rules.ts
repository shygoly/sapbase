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

const EVOLUTION_SCOPES = new Set([
  'object',
  'field',
  'form',
  'flow',
  'rule',
  'permission',
  'knowledge',
])

export function assertEvolutionBinding(input: {
  platformVersion?: string | null
  evolutionScope?: readonly string[] | null
}): void {
  if (!input.platformVersion || !input.platformVersion.trim()) {
    throw new Error('实例演进提议必须绑定 platformVersion')
  }
  if (!input.evolutionScope || input.evolutionScope.length === 0) {
    throw new Error('实例演进提议必须绑定 evolutionScope')
  }
  const unknown = input.evolutionScope.filter((scope) => !EVOLUTION_SCOPES.has(scope))
  if (unknown.length > 0) {
    throw new Error(`evolutionScope 含未知范围：${unknown.join(', ')}`)
  }
}

const SCOPE_KEYS: Record<string, string[]> = {
  object: ['object', 'objects', 'entity', 'entities'],
  field: ['field', 'fields'],
  form: ['form', 'forms', 'page', 'pages', 'view', 'views'],
  flow: ['flow', 'flows', 'transition', 'transitions', 'state'],
  rule: ['rule', 'rules', 'validation'],
  permission: ['permission', 'permissions', 'role', 'roles'],
  knowledge: ['knowledge', 'skill', 'skills', 'feedback'],
}

const FORBIDDEN_DIFF_KEYS = [
  'tables',
  'table',
  'migrations',
  'migration',
  'tools',
  'toolContracts',
  'contracts',
  'platformCode',
  'code',
  'sql',
]

/**
 * 实例演进只到蓝图层：diff 顶层键必须落在已声明 evolutionScope 的允许集合内，
 * 改表/改工具契约等越界键直接拒绝。
 */
export function assertDiffWithinEvolutionScope(
  diff: Record<string, unknown>,
  evolutionScope: readonly string[] | null | undefined,
): void {
  if (!evolutionScope || evolutionScope.length === 0) return
  const allowed = new Set<string>()
  for (const scope of evolutionScope) {
    for (const key of SCOPE_KEYS[scope] ?? []) allowed.add(key)
  }
  for (const key of Object.keys(diff ?? {})) {
    if (FORBIDDEN_DIFF_KEYS.includes(key)) {
      throw new Error(`diff.${key} 超出实例演进范围（禁止改表/工具契约/平台代码）`)
    }
    if (!allowed.has(key)) {
      throw new Error(`diff.${key} 不在 evolutionScope 内`)
    }
  }
}

export function assertApproverDistinct(input: { createdBy?: string | null; createdByAgent?: string | null; approverId: string }): void {
  if (input.createdBy && input.createdBy === input.approverId) throw new Error('作者不能批准自己起草的提议')
  if (input.createdByAgent && input.createdByAgent === input.approverId) throw new Error('智能体不能批准自己起草的提议')
}

export function needsSecondApprover(risk: Record<string, unknown>): boolean {
  return risk.permissionChange === true || risk.migration === true || risk.agentBehaviorChange === true
}
