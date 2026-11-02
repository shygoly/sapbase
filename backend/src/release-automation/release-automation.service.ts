import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ReleasesService } from '../releases/releases.service'
import { ReleaseAutomationPolicy } from './entities/release-automation-policy.entity'
import { ReleaseAutomationRun } from './entities/release-automation-run.entity'
import { AppReleaseActivation } from '../releases/entities/app-release-activation.entity'

export const A2_ALLOWED_CHANGE_CLASSES = [
  'copy',
  'changelog',
  'menu_label',
  'form_layout',
  'validation_message',
  'knowledge_instruction',
] as const

export const A2_FORBIDDEN_CHANGE_CLASSES = [
  'data',
  'flow',
  'permission',
  'agent',
  'tool',
  'skill',
  'migration',
  'rule',
] as const

@Injectable()
export class ReleaseAutomationService {
  constructor(
    @InjectRepository(ReleaseAutomationPolicy)
    private readonly policies: Repository<ReleaseAutomationPolicy>,
    @InjectRepository(ReleaseAutomationRun)
    private readonly runs: Repository<ReleaseAutomationRun>,
    @InjectRepository(AppReleaseActivation)
    private readonly activations: Repository<AppReleaseActivation>,
    private readonly releases: ReleasesService,
  ) {}

  async policy(organizationId: string, appKey: string): Promise<ReleaseAutomationPolicy> {
    const policy = await this.policies.findOne({ where: { organizationId, appKey } })
    if (!policy) throw new NotFoundException('A2 策略不存在')
    return policy
  }

  async upsertPolicy(input: {
    organizationId: string
    appKey: string
    autonomy: 'A1' | 'A2'
    enabled: boolean
    allowedChangeClasses: string[]
    guardrails?: Record<string, unknown>
    autoRollbackEnabled?: boolean
    canaryStages?: number[]
    reviewedBy?: string | null
  }): Promise<ReleaseAutomationPolicy> {
    if (input.autoRollbackEnabled && Object.keys(input.guardrails ?? {}).length === 0) {
      throw new ConflictException('未配置护栏阈值时不能开启自动回退')
    }
    const forbidden = input.allowedChangeClasses.filter((item) =>
      (A2_FORBIDDEN_CHANGE_CLASSES as readonly string[]).includes(item),
    )
    if (forbidden.length > 0) {
      throw new ConflictException(`A2 不允许结构性变更类：${forbidden.join(',')}`)
    }
    const existing = await this.policies.findOne({
      where: { organizationId: input.organizationId, appKey: input.appKey },
    })
    const policy = existing ?? this.policies.create({ organizationId: input.organizationId, appKey: input.appKey })
    policy.autonomy = input.autonomy
    policy.enabled = input.enabled
    policy.allowedChangeClasses = input.allowedChangeClasses
    policy.guardrails = input.guardrails ?? {}
    policy.autoRollbackEnabled = input.autoRollbackEnabled ?? false
    policy.canaryStages = input.canaryStages ?? [5, 25, 100]
    policy.reviewedBy = input.reviewedBy ?? null
    policy.lastReviewedAt = new Date()
    return this.policies.save(policy)
  }

  assertEligible(policy: ReleaseAutomationPolicy, changeClasses: string[]): void {
    if (policy.autonomy !== 'A2' || !policy.enabled) {
      throw new ConflictException({ code: 'DENIED', message: 'A2 未启用' })
    }
    const forbidden = changeClasses.filter((item) =>
      (A2_FORBIDDEN_CHANGE_CLASSES as readonly string[]).includes(item),
    )
    if (forbidden.length > 0) {
      throw new ConflictException({ code: 'DENIED', message: `结构性变更禁止 A2：${forbidden.join(',')}` })
    }
    const notAllowed = changeClasses.filter(
      (item) => !(A2_ALLOWED_CHANGE_CLASSES as readonly string[]).includes(item),
    )
    if (notAllowed.length > 0) {
      throw new ConflictException({ code: 'DENIED', message: `变更类不在 A2 白名单：${notAllowed.join(',')}` })
    }
  }

  async publish(input: {
    organizationId: string
    appKey: string
    changeClasses: string[]
    version: string
    manifest: Record<string, unknown>
    changelog: Record<string, unknown>
    compatibility?: Record<string, unknown>
    migrations?: Array<{ id: string; rollbackSafe?: boolean }>
  }) {
    const policy = await this.policy(input.organizationId, input.appKey)
    this.assertEligible(policy, input.changeClasses)
    const release = await this.releases.publish({
      organizationId: input.organizationId,
      appKey: input.appKey,
      version: input.version,
      channel: 'canary',
      manifest: input.manifest,
      changelog: input.changelog,
      compatibility: input.compatibility,
      migrations: input.migrations,
      publishedBy: null,
    })
    await this.runs.save(
      this.runs.create({
        policyId: policy.id,
        releaseId: release.id,
        action: 'publish',
        status: 'success',
        actorId: null,
        actorAgent: null,
        details: { changeClasses: input.changeClasses, channel: release.channel },
      }),
    )
    return release
  }

  async rollback(input: {
    organizationId: string
    appKey: string
    appInstallationId: string
    releaseId: string
    reason: string
  }) {
    const policy = await this.policy(input.organizationId, input.appKey)
    if (!policy.autoRollbackEnabled) {
      throw new ConflictException({ code: 'DENIED', message: '未开启自动回退，只能人工回退' })
    }
    if (Object.keys(policy.guardrails ?? {}).length === 0) {
      throw new ConflictException({ code: 'DENIED', message: '未配置护栏阈值，禁止自动回退' })
    }
    const activation = await this.releases.rollback({
      organizationId: input.organizationId,
      appInstallationId: input.appInstallationId,
      releaseId: input.releaseId,
      reason: input.reason,
      activatedBy: null,
    })
    await this.runs.save(
      this.runs.create({
        policyId: policy.id,
        releaseId: input.releaseId,
        action: 'rollback',
        status: 'success',
        actorId: null,
        actorAgent: null,
        details: { reason: input.reason },
      }),
    )
    return activation
  }

  evaluateGuardrails(metrics: Record<string, number>, guardrails: Record<string, unknown>): string[] {
    const violations: string[] = []
    for (const [key, raw] of Object.entries(guardrails)) {
      const limit = Number(raw)
      const value = Number(metrics[key])
      if (Number.isFinite(limit) && Number.isFinite(value) && value > limit) violations.push(`${key}=${value} > ${limit}`)
    }
    return violations
  }

  async promote(input: { organizationId: string; appKey: string; appInstallationId: string; releaseId: string; actorId: string }) {
    const policy = await this.policy(input.organizationId, input.appKey)
    if (policy.autonomy !== 'A2' || !policy.enabled) throw new ConflictException('A2 ???')
    const current = await this.activations.findOne({ where: { appInstallationId: input.appInstallationId, status: 'active' } })
    if (current) {
      current.status = 'superseded'
      await this.activations.save(current)
    }
    const activation = await this.releases.activate({
      organizationId: input.organizationId,
      appInstallationId: input.appInstallationId,
      releaseId: input.releaseId,
      action: 'upgrade',
      cohort: null,
      activatedBy: input.actorId,
    })
    await this.runs.save(this.runs.create({ policyId: policy.id, releaseId: input.releaseId, action: 'activate', status: 'success', actorId: input.actorId, actorAgent: null, details: { promotedTo: 100 } }))
    return activation
  }

  async quarterlyAudit(organizationId: string) {
    const policies = await this.policies.find({ where: { organizationId } })
    const runs = await this.runs.find({ where: { policyId: policies.length ? policies[0].id : undefined } })
    const structuralAutoPublishes = runs.filter((run) => run.action === 'publish' && (run.details as { structural?: boolean }).structural === true).length
    return {
      organizationId,
      policies: policies.length,
      runs: runs.length,
      rollbacks: runs.filter((run) => run.action === 'rollback').length,
      structuralAutoPublishes,
      ok: structuralAutoPublishes === 0,
    }
  }

  async review(input: { organizationId: string; appKey: string; reviewedBy: string; clean: boolean }) {
    const policy = await this.policy(input.organizationId, input.appKey)
    policy.consecutiveCleanRuns = input.clean ? policy.consecutiveCleanRuns + 1 : 0
    policy.lastReviewedAt = new Date()
    policy.reviewedBy = input.reviewedBy
    if (!input.clean) policy.enabled = false
    const saved = await this.policies.save(policy)
    await this.runs.save(
      this.runs.create({
        policyId: policy.id,
        action: 'review',
        status: 'success',
        actorId: input.reviewedBy,
        actorAgent: null,
        details: { clean: input.clean, consecutiveCleanRuns: saved.consecutiveCleanRuns },
      }),
    )
    return saved
  }

  async disable(organizationId: string, appKey: string, actorId: string) {
    const policy = await this.policy(organizationId, appKey)
    policy.enabled = false
    const saved = await this.policies.save(policy)
    await this.runs.save(
      this.runs.create({
        policyId: policy.id,
        action: 'disable',
        status: 'success',
        actorId,
        actorAgent: null,
        details: {},
      }),
    )
    return saved
  }
}
