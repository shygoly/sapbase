import { Injectable } from '@nestjs/common'
import { ALL, NONE, and, eq, exists, inList, not, or } from './scope-expr'
import {
  ScopeResolutionError,
  type DataPolicyView,
  type ScopeActor,
  type ScopeBindingView,
  type ScopeDepth,
  type ScopeEvaluationInput,
  type ScopeExpr,
  type ScopeFieldRef,
  type ScopeMembershipView,
  type ScopeNodeView,
  type ScopeSpec,
  type ScopeSubject,
  type ScopeValue,
} from './data-scope.types'

/**
 * 纯解析器：入参是已加载的数据快照，不碰 IO。
 *
 * fail-closed：
 *   - 未声明 dataScope → all（保持租户隔离的旧行为）
 *   - 已声明但无绑定/无策略/无成员 → none
 *   - 绑定缺失/配置非法 → 抛 ScopeResolutionError；调用方必须按 none 处理
 */
@Injectable()
export class ScopeEvaluator {
  evaluate(input: ScopeEvaluationInput): ScopeExpr {
    if (!input.declared) return ALL
    if (input.bindings.length === 0) return NONE

    const now = input.now ?? new Date()
    const policies = input.policies.filter(
      (policy) =>
        policy.status !== 'inactive' &&
        policy.resourceKey === input.resourceKey &&
        policy.actions.includes(input.action) &&
        this.subjectMatches(policy.subject, input.actor, input.memberships, now),
    )
    if (policies.length === 0) return NONE

    const allows = policies.filter((policy) => policy.effect === 'allow')
    const denies = policies.filter((policy) => policy.effect === 'deny')
    if (allows.length === 0) return NONE

    let expr = or(...allows.map((policy) => this.compileSpec(policy.scope, input, now)))
    if (input.packageCap) {
      expr = and(expr, this.compileSpec(input.packageCap, input, now))
    }
    if (denies.length > 0) {
      expr = and(expr, not(or(...denies.map((policy) => this.compileSpec(policy.scope, input, now)))))
    }
    return expr
  }

  private compileSpec(spec: ScopeSpec, input: ScopeEvaluationInput, now: Date): ScopeExpr {
    switch (spec.kind) {
      case 'all':
        return ALL
      case 'self': {
        const binding = this.findBinding(input.bindings, 'owner')
        const field = spec.field ?? binding?.field ?? null
        if (!field) {
          throw new ScopeResolutionError(
            `资源 ${input.resourceKey} 的 self 范围缺少 owner 字段`,
            'missing-owner-field',
          )
        }
        return eq(this.fieldRef(input.resourceKey, field), { kind: 'actor' })
      }
      case 'nodes': {
        const binding = this.findBinding(input.bindings, 'field', spec.dimension)
        if (!binding?.field) {
          throw new ScopeResolutionError(
            `资源 ${input.resourceKey} 缺少维度 ${spec.dimension} 的字段绑定`,
            'missing-binding',
          )
        }
        return inList(
          this.fieldRef(input.resourceKey, binding.field),
          spec.nodeIds.map((id) => ({ kind: 'literal', value: id }) satisfies ScopeValue),
        )
      }
      case 'node': {
        const binding = this.findBinding(input.bindings, 'field', spec.dimension)
        if (!binding?.field) {
          throw new ScopeResolutionError(
            `资源 ${input.resourceKey} 缺少维度 ${spec.dimension} 的字段绑定`,
            'missing-binding',
          )
        }
        const memberships = input.memberships.filter(
          (membership) =>
            this.membershipMatchesActor(membership, input.actor, now) &&
            (!spec.positions || spec.positions.includes(membership.positionKey)),
        )
        const targetNodes = input.nodes.filter((node) => node.dimensionKey === spec.dimension)
        const nodeIds = new Set<string>()
        for (const membership of memberships) {
          const anchor = membership.node
          if (!anchor) continue
          if (anchor.dimensionKey === spec.dimension) {
            for (const id of this.expandNode(anchor, targetNodes, spec.depth)) nodeIds.add(id)
            continue
          }
          // 跨维度祖先：例如 campus 成员 + class 维度策略；路径共享前缀时才允许。
          if (
            spec.depth === 'subtree' &&
            targetNodes.some((node) => node.path.startsWith(`${anchor.path}/`))
          ) {
            for (const node of targetNodes) {
              if (node.path.startsWith(`${anchor.path}/`)) nodeIds.add(node.id)
            }
          }
        }
        if (nodeIds.size === 0) return NONE
        return inList(
          this.fieldRef(input.resourceKey, binding.field),
          [...nodeIds].sort().map((id) => ({ kind: 'literal', value: id }) satisfies ScopeValue),
        )
      }
      case 'relation': {
        const binding = this.findBinding(input.bindings, 'relation')
        const relation = spec.relation ?? binding?.relation ?? null
        if (!relation) {
          throw new ScopeResolutionError(
            `资源 ${input.resourceKey} 的关系范围缺少 relation 绑定`,
            'missing-relation',
          )
        }
        const source = relation.entity
          ? { kind: 'entity' as const, name: relation.entity }
          : relation.table
            ? { kind: 'table' as const, name: relation.table }
            : null
        if (!source) {
          throw new ScopeResolutionError(
            `资源 ${input.resourceKey} 的 relation 既没有 entity 也没有 table`,
            'missing-relation',
          )
        }
        const fromField: ScopeFieldRef = relation.entity
          ? { kind: 'jsonb', column: 'data', path: relation.fromField }
          : { kind: 'column', column: relation.fromField }
        const actorField: ScopeFieldRef = relation.entity
          ? { kind: 'jsonb', column: 'data', path: relation.actorField }
          : { kind: 'column', column: relation.actorField }
        return exists(
          source,
          and(
            eq(fromField, { kind: 'row', field: 'id' }),
            eq(actorField, { kind: 'actor' }),
          ),
        )
      }
      default:
        throw new ScopeResolutionError(
          `未知范围类型 ${(spec as { kind?: string }).kind ?? '(missing)'}`,
          'unknown-scope',
        )
    }
  }

  private findBinding(
    bindings: readonly ScopeBindingView[],
    kind: ScopeBindingView['kind'],
    dimension?: string,
  ): ScopeBindingView | undefined {
    return bindings.find(
      (binding) =>
        binding.kind === kind &&
        (dimension === undefined || binding.dimensionKey === dimension),
    )
  }

  /**
   * 资源键命名空间决定字段落在普通列还是 JSONB：
   *   platform:* → 列
   *   blueprint:* / app:* → blueprint_records.data->>'field'
   */
  private fieldRef(resourceKey: string, field: string): ScopeFieldRef {
    if (resourceKey.startsWith('platform:')) {
      return { kind: 'column', column: field }
    }
    return { kind: 'jsonb', column: 'data', path: field }
  }

  private membershipMatchesActor(
    membership: ScopeMembershipView,
    actor: ScopeActor,
    now: Date,
  ): boolean {
    if (!this.isActive(membership, now)) return false
    if (membership.subjectType === 'user') return membership.subjectId === actor.userId
    if (membership.subjectType === 'role') return actor.roleKeys?.includes(membership.subjectId) === true
    if (membership.subjectType === 'group') return actor.groupKeys?.includes(membership.subjectId) === true
    return false
  }

  private subjectMatches(
    subject: ScopeSubject,
    actor: ScopeActor,
    memberships: readonly ScopeMembershipView[],
    now: Date,
  ): boolean {
    switch (subject.kind) {
      case 'user':
        return subject.userId === actor.userId
      case 'role':
        return actor.roleKeys?.includes(subject.roleKey) === true
      case 'group':
        return actor.groupKeys?.includes(subject.groupKey) === true
      case 'position':
        return memberships.some(
          (membership) =>
            membership.subjectType === 'user' &&
            membership.subjectId === actor.userId &&
            membership.positionKey === subject.positionKey &&
            this.isActive(membership, now),
        )
      default:
        return false
    }
  }

  private isActive(membership: ScopeMembershipView, now: Date): boolean {
    if (membership.validFrom) {
      const from = new Date(membership.validFrom).getTime()
      if (Number.isFinite(from) && from > now.getTime()) return false
    }
    if (membership.validTo) {
      const to = new Date(membership.validTo).getTime()
      if (Number.isFinite(to) && to < now.getTime()) return false
    }
    return true
  }

  private expandNode(
    anchor: ScopeNodeView,
    nodes: readonly ScopeNodeView[],
    depth: ScopeDepth,
  ): string[] {
    if (depth === 'exact') return [anchor.id]
    if (depth === 'subtree') {
      const prefix = `${anchor.path}/`
      return nodes
        .filter(
          (node) =>
            node.dimensionKey === anchor.dimensionKey &&
            (node.path === anchor.path || node.path.startsWith(prefix)),
        )
        .map((node) => node.id)
    }
    // ancestors：/a/b/c → /a、/a/b、/a/b/c
    const parts = anchor.path.split('/').filter(Boolean)
    const wanted = new Set<string>()
    let current = ''
    for (const part of parts) {
      current += `/${part}`
      wanted.add(current)
    }
    return nodes
      .filter((node) => node.dimensionKey === anchor.dimensionKey && wanted.has(node.path))
      .map((node) => node.id)
  }
}
