import type { EntityManager } from 'typeorm'

/**
 * platform-release 与应用层之间的端口。
 *
 * `releases` / `release-automation` 要被 `apps/api` 装配，但不能反向 import
 * 应用层模块（ai-modules / outbox / notifications / agent-eval）。这里用结构化
 * 接口把依赖方向倒过来：应用层实现这些端口，并在自己的模块里用工厂装配
 * ReleasesService（见 apps/api/src/releases/releases.module.ts）。
 */

export interface ReleaseAiModuleView {
  id: string
  name: string
  description?: string | null
}

export interface ReleaseAiModulePort {
  findOne(id: string, organizationId: string): Promise<ReleaseAiModuleView>
  getDefinition(id: string): Promise<unknown | null>
}

export interface ReleaseOutboxEvent {
  topic: string
  payload: Record<string, unknown>
  organizationId: string
  idempotencyKey: string
  aggregateType?: string | null
  aggregateId?: string | null
  occurredAt?: Date
}

export interface ReleaseOutboxPort {
  publish(manager: EntityManager, event: ReleaseOutboxEvent): Promise<unknown>
}

export interface ReleaseNotificationInput {
  organizationId: string
  userId: string
  type: string
  title: string
  body: string | null
  read: boolean
  sourceEventId: string | null
  metadata: Record<string, unknown> | null
}

/** 只暴露 releases 用到的两个 Repository 方法，避免把通知实体拖进 lib。 */
export interface ReleaseNotificationStore {
  create(input: ReleaseNotificationInput): ReleaseNotificationInput
  save(entity: ReleaseNotificationInput): Promise<unknown>
}

export interface ReleaseEvalRunView {
  modelId?: string | null
  suite: string
  passed: number
  failed: number
}

export interface ReleaseEvalGateInput {
  suite: string
  passed: number
  failed: number
  writeUnconfirmed?: number
  injectionPassRate?: number
  previous?: { passed: number; failed: number } | null
}

export interface ReleaseEvalPort {
  listRuns(releaseId: string): Promise<ReleaseEvalRunView[]>
  gate(input: ReleaseEvalGateInput): { ok: boolean; reasons: string[] }
}

export interface ReleaseTestEvidencePort {
  findFresh(organizationId: string, appKey: string, hours?: number): Promise<{ jestOutputDigest: string; ranAt: Date; commitSha?: string | null } | null>
}
