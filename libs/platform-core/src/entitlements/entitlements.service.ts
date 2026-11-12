import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { LessThanOrEqual, Repository } from 'typeorm'
import { Organization } from '../organizations/organization.entity'
import { AppEntitlement } from './app-entitlement.entity'
import {
  PLAN_CATALOG,
  findPlan,
  planAppKeys,
  planLimitsFor,
  type PlanDefinition,
} from './plan-catalog'
import { UsageMeteringService } from './usage-metering.service'

export interface SyncPlanResult {
  organizationId: string
  planName: string
  planKey: string
  created: string[]
  updated: string[]
  suspended: string[]
  entitlements: AppEntitlement[]
}

export interface QuotaCheckInput {
  organizationId: string
  appKey: string
  metric: string
  amount?: number
  /** 调用方已统计的当前用量（如安装数）；缺省读月度计量汇总。 */
  used?: number
  entitlement?: AppEntitlement | null
}

export interface QuotaCheckResult {
  allowed: boolean
  metric: string
  limit: number | null
  used: number
  requested: number
}

/**
 * 组织级应用权益（6.1）。
 *
 * - 计划 → 应用/配额映射由 `plan-catalog.ts` 唯一维护；
 * - `syncPlan()` 物化 `app_entitlements`，幂等，不删除手工权益；
 * - 安装/工具调用等入口通过 `assertEntitled()` + `assertWithinQuota()` 做准入；
 * - 没有任何 entitlement 的组织保持旧行为（迁移期兼容），一旦同步过计划即 fail-closed。
 */
@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(AppEntitlement)
    private readonly repository: Repository<AppEntitlement>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    private readonly usage: UsageMeteringService,
  ) {}

  async list(organizationId: string): Promise<AppEntitlement[]> {
    this.requireOrganization(organizationId)
    return this.repository.find({
      where: { organizationId },
      order: { appKey: 'ASC' },
    })
  }

  /** 组织是否已启用权益控制；未启用时调用方走迁移期兼容路径。 */
  async hasAny(organizationId: string): Promise<boolean> {
    this.requireOrganization(organizationId)
    const count = await this.repository.count({ where: { organizationId } })
    return count > 0
  }

  async findActive(
    organizationId: string,
    appKey: string,
    at: Date = new Date(),
  ): Promise<AppEntitlement | null> {
    this.requireOrganization(organizationId)
    if (!appKey) throw new BadRequestException('缺少 appKey')
    const entitlement = await this.repository.findOne({
      where: { organizationId, appKey },
    })
    if (!entitlement) return null
    if (entitlement.status !== 'active') return null
    if (entitlement.validFrom && entitlement.validFrom.getTime() > at.getTime()) {
      return null
    }
    if (entitlement.validTo && entitlement.validTo.getTime() <= at.getTime()) {
      return null
    }
    return entitlement
  }

  async assertEntitled(
    organizationId: string,
    appKey: string,
    at: Date = new Date(),
  ): Promise<AppEntitlement> {
    const entitlement = await this.findActive(organizationId, appKey, at)
    if (!entitlement) {
      throw new ForbiddenException(`组织未获得应用 ${appKey} 的有效授权`)
    }
    return entitlement
  }

  async checkWithinQuota(input: QuotaCheckInput): Promise<QuotaCheckResult> {
    const requested = input.amount ?? 1
    if (!Number.isFinite(requested) || requested < 0) {
      throw new BadRequestException('amount 必须是非负数')
    }
    const entitlement =
      input.entitlement === undefined
        ? await this.findActive(input.organizationId, input.appKey)
        : input.entitlement
    if (!entitlement) {
      return {
        allowed: true,
        metric: input.metric,
        limit: null,
        used: input.used ?? 0,
        requested,
      }
    }
    const rawLimit = entitlement.limits?.[input.metric]
    const limit = Number(rawLimit)
    if (!Number.isFinite(limit) || limit <= 0) {
      return {
        allowed: true,
        metric: input.metric,
        limit: null,
        used: input.used ?? 0,
        requested,
      }
    }
    const used =
      input.used ??
      (await this.usage.currentUsage(
        input.organizationId,
        input.appKey,
        input.metric,
      ))
    return {
      allowed: used + requested <= limit,
      metric: input.metric,
      limit,
      used,
      requested,
    }
  }

  async assertWithinQuota(input: QuotaCheckInput): Promise<QuotaCheckResult> {
    const result = await this.checkWithinQuota(input)
    if (!result.allowed) {
      throw new ForbiddenException(
        `应用 ${input.appKey} 的 ${input.metric} 配额已用尽（${result.used}/${result.limit}）`,
      )
    }
    return result
  }

  /**
   * 按组织计划物化权益。未知计划 fail-closed；手工权益不被计划同步覆盖/删除。
   */
  async syncPlan(
    organizationId: string,
    planName?: string,
    createdById?: string,
  ): Promise<SyncPlanResult> {
    this.requireOrganization(organizationId)
    const organization = await this.organizations.findOne({
      where: { id: organizationId },
    })
    if (!organization) throw new NotFoundException('组织不存在')
    const rawPlan = planName ?? organization.planName
    const plan = findPlan(rawPlan)
    if (!plan) {
      throw new BadRequestException(`未知计划：${rawPlan ?? '(空)'}`)
    }

    const existing = await this.repository.find({ where: { organizationId } })
    const byApp = new Map(existing.map((row) => [row.appKey, row]))
    const knownApps = [
      ...new Set([
        ...PLAN_CATALOG.flatMap((item) => (item.apps === '*' ? [] : item.apps)),
        ...existing.map((row) => row.appKey),
      ]),
    ]
    const targetApps = planAppKeys(plan, knownApps)
    const limits = planLimitsFor(plan) as unknown as Record<string, number>
    const created: string[] = []
    const updated: string[] = []
    const suspended: string[] = []

    for (const appKey of targetApps) {
      const current = byApp.get(appKey)
      if (!current) {
        const row = this.repository.create({
          organizationId,
          appKey,
          planName: plan.key,
          status: 'active',
          source: 'plan',
          limits,
          validFrom: new Date(),
          validTo: null,
          createdById: createdById ?? null,
        })
        await this.repository.save(row)
        created.push(appKey)
        continue
      }
      if (current.source !== 'plan') continue
      current.planName = plan.key
      current.limits = limits
      current.status = 'active'
      current.validFrom = current.validFrom ?? new Date()
      current.validTo = null
      await this.repository.save(current)
      updated.push(appKey)
    }

    for (const row of existing) {
      if (row.source !== 'plan') continue
      if (targetApps.includes(row.appKey)) continue
      if (row.status === 'suspended') continue
      row.status = 'suspended'
      await this.repository.save(row)
      suspended.push(row.appKey)
    }

    return {
      organizationId,
      planName: plan.name,
      planKey: plan.key,
      created,
      updated,
      suspended,
      entitlements: await this.list(organizationId),
    }
  }

  /** 供安装等入口读取计划覆盖的应用；未知计划返回空列表。 */
  planApps(planName?: string | null): string[] {
    const plan: PlanDefinition | null = findPlan(planName)
    if (!plan) return []
    return planAppKeys(plan, PLAN_CATALOG.flatMap((item) => (item.apps === '*' ? [] : item.apps)))
  }

  /** 标记过期权益；供定时任务/运营脚本使用，幂等。 */
  async expireOutdated(organizationId: string, at: Date = new Date()): Promise<number> {
    this.requireOrganization(organizationId)
    const result = await this.repository.update(
      {
        organizationId,
        status: 'active',
        validTo: LessThanOrEqual(at),
      },
      { status: 'expired' },
    )
    return result.affected ?? 0
  }

  private requireOrganization(organizationId: string): void {
    if (!organizationId) throw new BadRequestException('缺少组织上下文')
  }
}
