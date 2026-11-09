import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { ALL, NONE } from './scope-expr'
import { ScopeEvaluator } from './scope-evaluator'
import {
  ScopeResolutionError,
  type DataPolicyView,
  type ScopeActor,
  type ScopeBindingView,
  type ScopeExpr,
  type ScopeMembershipView,
  type ScopeNodeView,
  type ScopeSpec,
} from './data-scope.types'
import { DataPolicy } from './entities/data-policy.entity'
import { ScopeBinding } from './entities/scope-binding.entity'
import { ScopeDimension } from './entities/scope-dimension.entity'
import { ScopeMembership } from './entities/scope-membership.entity'
import { ScopeNode } from './entities/scope-node.entity'
import { ScopeVersion } from './entities/scope-version.entity'

export interface ResolveScopeInput {
  organizationId: string
  actor: ScopeActor
  resourceKey: string
  action: string
  /** 蓝图包内声明的绑定（覆盖 DB；用于 blueprint:* 资源） */
  bindings?: readonly ScopeBindingView[]
  /** 蓝图包内声明的策略模板（覆盖 DB；用于 blueprint:* 资源） */
  policies?: readonly DataPolicyView[]
  /** 蓝图模板 cap；租户策略只能收窄 */
  packageCap?: ScopeSpec | null
  /** 显式声明；缺省按 bindings 是否为空判断 */
  declared?: boolean
}

export interface ResolvedScope {
  expr: ScopeExpr
  version: number
  declared: boolean
}

export interface CreateScopeDimensionInput {
  key: string
  name: string
  description?: string | null
  config?: Record<string, unknown> | null
}

export interface CreateScopeNodeInput {
  dimensionId: string
  parentId?: string | null
  name: string
  code?: string | null
  metadata?: Record<string, unknown> | null
}

export interface CreateScopeMembershipInput {
  subjectType: 'user' | 'role' | 'group'
  subjectId: string
  nodeId: string
  positionKey: string
  validFrom?: Date | string | null
  validTo?: Date | string | null
  metadata?: Record<string, unknown> | null
}

export interface CreateScopeBindingInput {
  resourceKey: string
  dimensionKey: string
  kind: 'field' | 'owner' | 'relation'
  field?: string | null
  relation?: ScopeBindingView['relation'] | null
  writable?: boolean
}

export interface CreateDataPolicyInput {
  name: string
  subject: DataPolicyView['subject']
  resourceKey: string
  actions: string[]
  effect?: 'allow' | 'deny'
  scope: ScopeSpec
  priority?: number
}

@Injectable()
export class DataScopeService {
  private readonly cache = new Map<string, { expr: ScopeExpr; expiresAt: number }>()
  private readonly cacheTtlMs = 30_000

  constructor(
    @InjectRepository(ScopeDimension)
    private readonly dimensions: Repository<ScopeDimension>,
    @InjectRepository(ScopeNode)
    private readonly nodes: Repository<ScopeNode>,
    @InjectRepository(ScopeMembership)
    private readonly memberships: Repository<ScopeMembership>,
    @InjectRepository(ScopeBinding)
    private readonly bindings: Repository<ScopeBinding>,
    @InjectRepository(DataPolicy)
    private readonly policies: Repository<DataPolicy>,
    @InjectRepository(ScopeVersion)
    private readonly versions: Repository<ScopeVersion>,
    private readonly evaluator: ScopeEvaluator,
  ) {}

  async resolve(input: ResolveScopeInput): Promise<ResolvedScope> {
    const version = await this.getVersion(input.organizationId)
    const cacheable = input.bindings === undefined && input.policies === undefined
    const cacheKey = this.cacheKey(input, version)
    if (cacheable) {
      const hit = this.cache.get(cacheKey)
      if (hit && hit.expiresAt > Date.now()) {
        return { expr: hit.expr, version, declared: input.declared ?? hit.expr.op !== 'all' }
      }
    }

    const bindings = input.bindings ?? (await this.loadBindings(input.organizationId, input.resourceKey))
    const declared = input.declared ?? bindings.length > 0
    const policies =
      input.policies ??
      (await this.loadPolicies(input.organizationId, input.resourceKey, input.action))
    const memberships = await this.loadMemberships(input.organizationId, input.actor)
    const nodes = await this.loadNodeViews(input.organizationId)

    let expr: ScopeExpr
    try {
      expr = this.evaluator.evaluate({
        resourceKey: input.resourceKey,
        action: input.action,
        actor: input.actor,
        declared,
        bindings,
        policies,
        memberships,
        nodes,
        packageCap: input.packageCap ?? null,
      })
    } catch (error) {
      // 解析失败一律 fail-closed；日志由调用方/审计补
      if (error instanceof ScopeResolutionError) expr = NONE
      else throw error
    }

    if (cacheable) {
      this.cache.set(cacheKey, { expr, expiresAt: Date.now() + this.cacheTtlMs })
    }
    return { expr, version, declared }
  }

  async getVersion(organizationId: string): Promise<number> {
    const row = await this.versions.findOne({ where: { organizationId } })
    if (row) return row.version
    const created = this.versions.create({ organizationId, version: 1 })
    await this.versions.save(created)
    return 1
  }

  async bumpVersion(organizationId: string): Promise<number> {
    await this.versions.manager.query(
      `INSERT INTO public.scope_versions ("organizationId", version, "createdAt", "updatedAt")
       VALUES ($1, 1, now(), now())
       ON CONFLICT ("organizationId")
       DO UPDATE SET version = scope_versions.version + 1, "updatedAt" = now()`,
      [organizationId],
    )
    this.cache.clear()
    return this.getVersion(organizationId)
  }

  async listDimensions(organizationId: string): Promise<ScopeDimension[]> {
    return this.dimensions.find({ where: { organizationId }, order: { createdAt: 'ASC' } })
  }

  async createDimension(
    organizationId: string,
    input: CreateScopeDimensionInput,
  ): Promise<ScopeDimension> {
    const row = this.dimensions.create({
      organizationId,
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      config: input.config ?? null,
    })
    const saved = await this.dimensions.save(row)
    await this.bumpVersion(organizationId)
    return saved
  }

  async deleteDimension(organizationId: string, id: string): Promise<void> {
    const result = await this.dimensions.delete({ id, organizationId })
    if (!result.affected) throw new NotFoundException('Scope dimension not found')
    await this.bumpVersion(organizationId)
  }

  async listNodes(organizationId: string, dimensionId?: string): Promise<ScopeNode[]> {
    return this.nodes.find({
      where: dimensionId ? { organizationId, dimensionId } : { organizationId },
      order: { path: 'ASC' },
    })
  }

  async createNode(organizationId: string, input: CreateScopeNodeInput): Promise<ScopeNode> {
    const dimension = await this.dimensions.findOne({
      where: { id: input.dimensionId, organizationId },
    })
    if (!dimension) throw new NotFoundException('Scope dimension not found')

    let parent: ScopeNode | null = null
    if (input.parentId) {
      parent = await this.nodes.findOne({
        where: { id: input.parentId, organizationId, dimensionId: input.dimensionId },
      })
      if (!parent) throw new NotFoundException('Parent scope node not found')
    }

    const id = randomUUID()
    const path = parent ? `${parent.path}/${id}` : `/${id}`
    const depth = parent ? parent.depth + 1 : 0
    const row = this.nodes.create({
      id,
      organizationId,
      dimensionId: input.dimensionId,
      parentId: parent?.id ?? null,
      path,
      depth,
      name: input.name,
      code: input.code ?? null,
      metadata: input.metadata ?? null,
    })
    const saved = await this.nodes.save(row)
    await this.bumpVersion(organizationId)
    return saved
  }

  async deleteNode(organizationId: string, id: string): Promise<void> {
    const result = await this.nodes.delete({ id, organizationId })
    if (!result.affected) throw new NotFoundException('Scope node not found')
    await this.bumpVersion(organizationId)
  }

  async listMemberships(organizationId: string, nodeId?: string): Promise<ScopeMembership[]> {
    return this.memberships.find({
      where: nodeId ? { organizationId, nodeId } : { organizationId },
      relations: ['node'],
      order: { createdAt: 'ASC' },
    })
  }

  async createMembership(
    organizationId: string,
    input: CreateScopeMembershipInput,
  ): Promise<ScopeMembership> {
    const node = await this.nodes.findOne({ where: { id: input.nodeId, organizationId } })
    if (!node) throw new NotFoundException('Scope node not found')
    const row = this.memberships.create({
      organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      nodeId: input.nodeId,
      positionKey: input.positionKey,
      validFrom: input.validFrom ? new Date(input.validFrom) : null,
      validTo: input.validTo ? new Date(input.validTo) : null,
      metadata: input.metadata ?? null,
    })
    const saved = await this.memberships.save(row)
    await this.bumpVersion(organizationId)
    return saved
  }

  async deleteMembership(organizationId: string, id: string): Promise<void> {
    const result = await this.memberships.delete({ id, organizationId })
    if (!result.affected) throw new NotFoundException('Scope membership not found')
    await this.bumpVersion(organizationId)
  }

  async listBindings(organizationId: string, resourceKey?: string): Promise<ScopeBinding[]> {
    return this.bindings.find({
      where: resourceKey ? { organizationId, resourceKey } : { organizationId },
      order: { createdAt: 'ASC' },
    })
  }

  async createBinding(
    organizationId: string,
    input: CreateScopeBindingInput,
  ): Promise<ScopeBinding> {
    const row = this.bindings.create({
      organizationId,
      resourceKey: input.resourceKey,
      dimensionKey: input.dimensionKey,
      kind: input.kind,
      field: input.field ?? null,
      relation: input.relation ?? null,
      writable: input.writable ?? true,
    })
    const saved = await this.bindings.save(row)
    await this.bumpVersion(organizationId)
    return saved
  }

  async deleteBinding(organizationId: string, id: string): Promise<void> {
    const result = await this.bindings.delete({ id, organizationId })
    if (!result.affected) throw new NotFoundException('Scope binding not found')
    await this.bumpVersion(organizationId)
  }

  async listPolicies(organizationId: string, resourceKey?: string): Promise<DataPolicy[]> {
    return this.policies.find({
      where: resourceKey ? { organizationId, resourceKey } : { organizationId },
      order: { priority: 'DESC', createdAt: 'ASC' },
    })
  }

  async createPolicy(
    organizationId: string,
    input: CreateDataPolicyInput,
  ): Promise<DataPolicy> {
    const row = this.policies.create({
      organizationId,
      name: input.name,
      subject: input.subject,
      resourceKey: input.resourceKey,
      actions: input.actions,
      effect: input.effect ?? 'allow',
      scope: input.scope,
      priority: input.priority ?? 0,
    })
    const saved = await this.policies.save(row)
    await this.bumpVersion(organizationId)
    return saved
  }

  async deletePolicy(organizationId: string, id: string): Promise<void> {
    const result = await this.policies.delete({ id, organizationId })
    if (!result.affected) throw new NotFoundException('Data policy not found')
    await this.bumpVersion(organizationId)
  }

  async preview(input: ResolveScopeInput): Promise<ResolvedScope> {
    return this.resolve(input)
  }

  private cacheKey(input: ResolveScopeInput, version: number): string {
    return JSON.stringify({
      organizationId: input.organizationId,
      version,
      userId: input.actor.userId,
      roles: [...(input.actor.roleKeys ?? [])].sort(),
      groups: [...(input.actor.groupKeys ?? [])].sort(),
      resourceKey: input.resourceKey,
      action: input.action,
    })
  }

  private async loadBindings(
    organizationId: string,
    resourceKey: string,
  ): Promise<ScopeBindingView[]> {
    const rows = await this.bindings.find({ where: { organizationId, resourceKey } })
    return rows.map((row) => ({
      resourceKey: row.resourceKey,
      dimensionKey: row.dimensionKey,
      kind: row.kind,
      field: row.field,
      relation: row.relation,
      writable: row.writable,
    }))
  }

  private async loadPolicies(
    organizationId: string,
    resourceKey: string,
    action: string,
  ): Promise<DataPolicyView[]> {
    const rows = await this.policies.find({
      where: { organizationId, resourceKey, status: 'active' },
      order: { priority: 'DESC', createdAt: 'ASC' },
    })
    return rows
      .filter((row) => row.actions.includes(action))
      .map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        resourceKey: row.resourceKey,
        actions: row.actions,
        effect: row.effect,
        scope: row.scope,
        priority: row.priority,
        status: row.status,
      }))
  }

  private async loadMemberships(
    organizationId: string,
    actor: ScopeActor,
  ): Promise<ScopeMembershipView[]> {
    const clauses: Array<Record<string, unknown>> = [
      { organizationId, subjectType: 'user', subjectId: actor.userId },
    ]
    if (actor.roleKeys && actor.roleKeys.length > 0) {
      clauses.push({
        organizationId,
        subjectType: 'role',
        subjectId: In([...actor.roleKeys]),
      })
    }
    if (actor.groupKeys && actor.groupKeys.length > 0) {
      clauses.push({
        organizationId,
        subjectType: 'group',
        subjectId: In([...actor.groupKeys]),
      })
    }
    const rows = await this.memberships.find({
      where: clauses as never,
      relations: ['node', 'node.dimension'],
      order: { createdAt: 'ASC' },
    })
    return rows.map((row) => ({
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      nodeId: row.nodeId,
      positionKey: row.positionKey,
      validFrom: row.validFrom,
      validTo: row.validTo,
      node: row.node
        ? {
            id: row.node.id,
            dimensionKey: row.node.dimension?.key ?? '',
            path: row.node.path,
          }
        : undefined,
    }))
  }

  private async loadNodeViews(organizationId: string): Promise<ScopeNodeView[]> {
    const rows = await this.nodes.find({
      where: { organizationId },
      relations: ['dimension'],
      order: { path: 'ASC' },
    })
    return rows.map((row) => ({
      id: row.id,
      dimensionKey: row.dimension?.key ?? '',
      path: row.path,
    }))
  }
}
