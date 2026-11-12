/**
 * 计划 → 应用 entitlement 映射（6.1）。
 *
 * 这里是**产品计划**的唯一真源：计划包含哪些应用、默认配额多少。
 * 组织级 `app_entitlements` 由 `EntitlementsService.syncPlan()` 按此映射物化，
 * 手工授予/覆盖走 source=manual，不会被计划同步删除。
 */

export type PlanAppSelector = readonly string[] | '*'

export interface PlanLimits {
  /** 同组织同 appKey 的最大安装数。 */
  maxInstallations: number
  /** 最大 Blueprint 记录数（按组织 + blueprint 统计）。 */
  maxRecords: number
  /** 最大资产字节数（组织级配额，0 表示不单独限制）。 */
  maxStorageBytes: number
  /** 每月工具调用次数。 */
  maxMonthlyToolCalls: number
  /** 每月 Agent 运行次数。 */
  maxMonthlyAgentRuns: number
  /** 每月外部 API 调用次数。 */
  maxMonthlyApiCalls: number
}

export interface PlanDefinition {
  key: string
  name: string
  apps: PlanAppSelector
  limits: PlanLimits
}

const GB = 1024 * 1024 * 1024

export const PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    key: 'starter',
    name: 'Starter',
    apps: ['erp'],
    limits: {
      maxInstallations: 1,
      maxRecords: 10_000,
      maxStorageBytes: 1 * GB,
      maxMonthlyToolCalls: 5_000,
      maxMonthlyAgentRuns: 500,
      maxMonthlyApiCalls: 10_000,
    },
  },
  {
    key: 'pro',
    name: 'Pro',
    apps: ['erp', 'crm', 'education', 'auto-parts'],
    limits: {
      maxInstallations: 3,
      maxRecords: 100_000,
      maxStorageBytes: 10 * GB,
      maxMonthlyToolCalls: 50_000,
      maxMonthlyAgentRuns: 5_000,
      maxMonthlyApiCalls: 200_000,
    },
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    apps: '*',
    limits: {
      maxInstallations: 20,
      maxRecords: 1_000_000,
      maxStorageBytes: 100 * GB,
      maxMonthlyToolCalls: 500_000,
      maxMonthlyAgentRuns: 50_000,
      maxMonthlyApiCalls: 2_000_000,
    },
  },
]

const PLAN_ALIASES: Record<string, string> = {
  free: 'starter',
  starter: 'starter',
  basic: 'starter',
  pro: 'pro',
  professional: 'pro',
  team: 'pro',
  enterprise: 'enterprise',
  business: 'enterprise',
}

/** 计划名大小写/别名归一；未知计划返回 null（调用方 fail-closed）。 */
export function normalizePlanName(raw?: string | null): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  return PLAN_ALIASES[key] ?? null
}

export function findPlan(raw?: string | null): PlanDefinition | null {
  const key = normalizePlanName(raw)
  if (!key) return null
  return PLAN_CATALOG.find((plan) => plan.key === key) ?? null
}

/** 计划是否包含某应用；'*' 表示全部。 */
export function planIncludesApp(plan: PlanDefinition, appKey: string): boolean {
  if (plan.apps === '*') return true
  return plan.apps.includes(appKey)
}

/** 计划覆盖的 appKey 列表；'*' 用给定已知应用补全，便于物化 entitlement。 */
export function planAppKeys(plan: PlanDefinition, knownAppKeys: readonly string[]): string[] {
  if (plan.apps === '*') return [...new Set(knownAppKeys)]
  return [...plan.apps]
}

export function planLimitsFor(plan: PlanDefinition): PlanLimits {
  return { ...plan.limits }
}
