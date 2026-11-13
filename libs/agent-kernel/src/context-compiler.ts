export type ContextNodeKind = 'knowledge' | 'tool' | 'entity' | 'screen' | 'memory'

export interface ContextNode {
  id: string
  kind: ContextNodeKind
  title?: string
  content?: string
  /** 估算 token；调用方负责给出确定性估算。 */
  tokens: number
  /** 依赖节点 id；闭包必须一起带入。 */
  dependsOn?: string[]
  /** 节点要求的全部功能权限点（all-of）。 */
  permissions?: string[]
  /** 预算冲突时的优先级，越大越先保留。 */
  score?: number
}

export interface ContextBudget {
  maxTokens: number
  maxNodes?: number
}

export type ContextDropReason =
  | 'missing'
  | 'permission'
  | 'budget'
  | 'cycle'

export interface DroppedContextNode {
  id: string
  reason: ContextDropReason
  missingDependencies?: string[]
}

export interface CompiledContext {
  nodes: ContextNode[]
  dropped: DroppedContextNode[]
  /** 闭包 + 权限过滤后的节点数（预算裁剪前）。 */
  closureSize: number
  tokens: number
  budget: { maxTokens: number; maxNodes: number }
}

/**
 * Context Compiler（5.3）：
 *
 * 1. 从 requested 节点出发解析 `dependsOn` 闭包；
 * 2. 缺依赖/环/权限不足的节点丢弃并记录原因；
 * 3. 在 token / 节点数预算内按 score 降序、id 升序确定性选择；
 * 4. 返回实际节点与预算裁剪原因，调用方不自行再截断。
 */
export function compileContext(input: {
  nodes: ContextNode[]
  requested: string[]
  permissions: readonly string[]
  budget: ContextBudget
}): CompiledContext {
  const maxTokens = Math.max(0, Number(input.budget.maxTokens) || 0)
  const maxNodes = Math.max(
    0,
    Number(input.budget.maxNodes ?? Number.MAX_SAFE_INTEGER),
  )
  const byId = new Map<string, ContextNode>()
  const duplicates = new Set<string>()
  for (const node of input.nodes) {
    if (!node.id) continue
    if (byId.has(node.id)) duplicates.add(node.id)
    else byId.set(node.id, node)
  }
  const dropped: DroppedContextNode[] = []
  for (const id of duplicates) dropped.push({ id, reason: 'missing' })

  const granted = new Set(input.permissions)
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const closure: ContextNode[] = []

  const visit = (id: string): 'ok' | 'missing' | 'cycle' => {
    if (visiting.has(id)) return 'cycle'
    if (visited.has(id)) return 'ok'
    const node = byId.get(id)
    if (!node) {
      dropped.push({ id, reason: 'missing' })
      return 'missing'
    }
    visiting.add(id)
    const missing: string[] = []
    for (const dependency of node.dependsOn ?? []) {
      const result = visit(dependency)
      if (result === 'missing') missing.push(dependency)
      if (result === 'cycle') {
        visiting.delete(id)
        dropped.push({ id, reason: 'cycle' })
        return 'cycle'
      }
    }
    visiting.delete(id)
    if (missing.length > 0) {
      dropped.push({ id, reason: 'missing', missingDependencies: missing })
      return 'missing'
    }
    const required = node.permissions ?? []
    if (required.some((permission) => !granted.has(permission))) {
      dropped.push({ id, reason: 'permission' })
      return 'missing'
    }
    visited.add(id)
    closure.push(node)
    return 'ok'
  }

  for (const id of input.requested) {
    if (!byId.has(id)) dropped.push({ id, reason: 'missing' })
    else visit(id)
  }

  const ordered = [...closure].sort(
    (left, right) =>
      (right.score ?? 0) - (left.score ?? 0) ||
      left.id.localeCompare(right.id),
  )
  const selected: ContextNode[] = []
  let tokens = 0
  for (const node of ordered) {
    if (selected.length >= maxNodes || tokens + node.tokens > maxTokens) {
      dropped.push({ id: node.id, reason: 'budget' })
      continue
    }
    selected.push(node)
    tokens += node.tokens
  }

  return {
    nodes: selected,
    dropped,
    closureSize: closure.length,
    tokens,
    budget: { maxTokens, maxNodes },
  }
}
