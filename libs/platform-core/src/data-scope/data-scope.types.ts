/**
 * 数据范围（Data Scope）的纯类型与 AST。
 *
 * 设计边界：
 *   - 不在这里做 IO；解析器只消费“已加载的绑定/成员/策略/节点”快照。
 *   - 输出 ScopeExpr 由适配器编译为 SQL；不在这里拼 SQL 字符串。
 *   - 范围只做收窄，不授予功能权限。
 */

export type ScopeDepth = 'exact' | 'subtree' | 'ancestors'

export type ScopeSubjectKind = 'user' | 'role' | 'group' | 'position'

export type ScopeSubject =
  | { kind: 'user'; userId: string }
  | { kind: 'role'; roleKey: string }
  | { kind: 'group'; groupKey: string }
  | { kind: 'position'; positionKey: string }

export interface RelationSpec {
  /** 蓝图关联实体（blueprint_records.entity） */
  entity?: string
  /** 平台关联表 */
  table?: string
  /** 关联行上指向当前资源的字段 */
  fromField: string
  /** 关联行上指向 actor 的字段 */
  actorField: string
}

export type ScopeSpec =
  | { kind: 'all' }
  | { kind: 'self'; field?: string }
  | { kind: 'nodes'; dimension: string; nodeIds: string[] }
  | {
      kind: 'node'
      dimension: string
      anchor: 'membership'
      positions?: string[]
      depth: ScopeDepth
    }
  | { kind: 'relation'; relation?: RelationSpec }

export type ScopeFieldRef =
  | { kind: 'column'; column: string; table?: string }
  | { kind: 'jsonb'; column: string; path: string; table?: string }

export type ScopeValue =
  | { kind: 'literal'; value: unknown }
  | { kind: 'row'; field: string }
  | { kind: 'actor'; field?: string }

export interface ScopeSourceRef {
  kind: 'entity' | 'table'
  name: string
  alias?: string
}

export type ScopeExpr =
  | { op: 'all' }
  | { op: 'none' }
  | { op: 'eq'; field: ScopeFieldRef; value: ScopeValue }
  | { op: 'in'; field: ScopeFieldRef; values: ScopeValue[] }
  | { op: 'exists'; source: ScopeSourceRef; where: ScopeExpr }
  | { op: 'and'; args: ScopeExpr[] }
  | { op: 'or'; args: ScopeExpr[] }
  | { op: 'not'; arg: ScopeExpr }

export interface ScopeActor {
  userId: string
  roleKeys?: readonly string[]
  groupKeys?: readonly string[]
  permissions?: readonly string[]
}

export interface ScopeNodeView {
  id: string
  dimensionKey: string
  /** 物化路径：包含自身 id，例如 /root/province/city */
  path: string
}

export interface ScopeMembershipView {
  subjectType: 'user' | 'role' | 'group'
  /** user 为 userId；role/group 为 roleKey/groupKey（varchar，不强制 uuid） */
  subjectId: string
  nodeId: string
  positionKey: string
  validFrom?: Date | string | null
  validTo?: Date | string | null
  node?: ScopeNodeView
}

export interface ScopeBindingView {
  resourceKey: string
  dimensionKey: string
  kind: 'field' | 'owner' | 'relation'
  field?: string | null
  relation?: RelationSpec | null
  writable?: boolean
}

export interface DataPolicyView {
  id?: string
  name?: string
  subject: ScopeSubject
  resourceKey: string
  actions: readonly string[]
  effect: 'allow' | 'deny'
  scope: ScopeSpec
  priority?: number
  status?: 'active' | 'inactive'
}

export interface ScopeEvaluationInput {
  resourceKey: string
  action: string
  actor: ScopeActor
  /** 资源是否声明了 dataScope；未声明 → 保持租户隔离，返回 all */
  declared: boolean
  bindings: readonly ScopeBindingView[]
  memberships: readonly ScopeMembershipView[]
  /** 所有节点快照；用于 subtree/ancestors 展开 */
  nodes: readonly ScopeNodeView[]
  policies: readonly DataPolicyView[]
  /** 蓝图模板 cap；租户策略只能收窄 */
  packageCap?: ScopeSpec | null
  now?: Date
}

export class ScopeResolutionError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | 'missing-binding'
      | 'missing-owner-field'
      | 'missing-relation'
      | 'unknown-scope'
      | 'unknown-policy-subject',
  ) {
    super(message)
    this.name = 'ScopeResolutionError'
  }
}
