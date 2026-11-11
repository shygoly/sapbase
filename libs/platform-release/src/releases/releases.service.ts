import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { DataSource, Repository } from 'typeorm'
import {
  assertPublishable,
  canTransitionProposal,
  canTransitionRelease,
  computeReleaseDigest,
  diffPlainObject,
} from '@sap/release-kernel'
import { ReleaseValidationService } from './release-validation.service'
import { ReleaseCacheService } from './release-cache.service'
import {
  type ReleaseAiModulePort,
  type ReleaseNotificationStore,
  type ReleaseOutboxPort,
} from './release-ports'
import { checkUpgradeConflicts, redactBackflow } from './evolution-backflow'
import {
  assertApproverDistinct,
  assertDiffWithinEvolutionScope,
  assertEvolutionBinding,
  assertProposalHardRequirements,
  needsSecondApprover,
} from './proposal-rules'
import {
  AppChangeProposal,
  AppDraft,
  AppRelease,
  AppReleaseActivation,
  AppReleaseApproval,
  AppReleaseEvent,
  AppReleaseItem,
  AppUserReleaseView,
} from './entities'

function enabled(): boolean {
  return process.env.RELEASE_ENABLED !== 'false'
}

function assertEnabled(): void {
  if (!enabled()) {
    throw new ConflictException({ code: 'UNAVAILABLE', message: 'release.enabled=false' })
  }
}

function previewSecret(): string {
  return process.env.RELEASE_PREVIEW_SECRET ?? process.env.JWT_SECRET ?? 'dev-release-preview-secret'
}

@Injectable()
export class ReleasesService {
  constructor(
    @InjectRepository(AppDraft) private readonly drafts: Repository<AppDraft>,
    @InjectRepository(AppChangeProposal) private readonly proposals: Repository<AppChangeProposal>,
    @InjectRepository(AppRelease) private readonly releases: Repository<AppRelease>,
    @InjectRepository(AppReleaseItem) private readonly items: Repository<AppReleaseItem>,
    @InjectRepository(AppReleaseActivation) private readonly activations: Repository<AppReleaseActivation>,
    @InjectRepository(AppReleaseApproval) private readonly approvals: Repository<AppReleaseApproval>,
    @InjectRepository(AppReleaseEvent) private readonly events: Repository<AppReleaseEvent>,
    @InjectRepository(AppUserReleaseView) private readonly views: Repository<AppUserReleaseView>,
    private readonly notifications: ReleaseNotificationStore,
    private readonly validation: ReleaseValidationService,
    private readonly outbox: ReleaseOutboxPort,
    private readonly dataSource: DataSource,
    private readonly aiModules: ReleaseAiModulePort,
    private readonly cache: ReleaseCacheService,
  ) {}

  async createDraft(input: {
    organizationId: string
    appKey: string
    baseReleaseId?: string | null
    content?: Record<string, unknown>
    createdBy?: string | null
  }): Promise<AppDraft> {
    assertEnabled()
    const last = await this.drafts.findOne({
      where: { organizationId: input.organizationId, appKey: input.appKey },
      order: { revision: 'DESC' },
    })
    return this.drafts.save(
      this.drafts.create({
        organizationId: input.organizationId,
        appKey: input.appKey,
        baseReleaseId: input.baseReleaseId ?? null,
        revision: (last?.revision ?? 0) + 1,
        content: input.content ?? {},
        createdBy: input.createdBy ?? null,
        status: 'draft',
      }),
    )
  }

  async getDraft(id: string, organizationId: string): Promise<AppDraft> {
    const draft = await this.drafts.findOne({ where: { id, organizationId } })
    if (!draft) throw new NotFoundException('draft 不存在')
    return draft
  }

  async createProposal(input: {
    organizationId: string
    appKey: string
    draftId: string
    type: string
    areas?: string[]
    title: string
    summary: string
    diff: Record<string, unknown>
    evidence?: unknown[]
    risk?: Record<string, unknown>
    testPlan?: Record<string, unknown>
    rollbackPlan?: Record<string, unknown>
    platformVersion?: string | null
    evolutionScope?: string[] | null
    createdByAgent?: string | null
    createdBy?: string | null
  }): Promise<AppChangeProposal> {
    assertEnabled()
    const draft = await this.getDraft(input.draftId, input.organizationId)
    if (draft.appKey !== input.appKey) throw new BadRequestException('提议只能修改目标 app 的 draft')
    try {
      assertProposalHardRequirements(input)
      assertDiffWithinEvolutionScope(input.diff, input.evolutionScope)
    } catch (error) {
      throw new BadRequestException((error as Error).message)
    }
    return this.proposals.save(
      this.proposals.create({
        organizationId: input.organizationId,
        appKey: input.appKey,
        draftId: input.draftId,
        type: input.type,
        areas: input.areas ?? [],
        title: input.title,
        summary: input.summary,
        diff: input.diff,
        evidence: input.evidence ?? [],
        risk: input.risk ?? {},
        testPlan: input.testPlan ?? {},
        rollbackPlan: input.rollbackPlan ?? {},
        platformVersion: input.platformVersion ?? null,
        evolutionScope: input.evolutionScope ?? null,
        createdByAgent: input.createdByAgent ?? null,
        createdBy: input.createdBy ?? null,
        status: 'draft',
      }),
    )
  }

  private assertProposalHardRequirements(input: {
    diff: Record<string, unknown>
    evidence?: unknown[]
    risk?: Record<string, unknown>
    testPlan?: Record<string, unknown>
    rollbackPlan?: Record<string, unknown>
  }): void {
    if (!input.evidence || input.evidence.length === 0) {
      throw new BadRequestException('提议必须至少有一条证据（feedback/metric/error）')
    }
    if (!input.diff || typeof input.diff !== 'object') {
      throw new BadRequestException('提议必须带结构化 diff')
    }
    const risk = input.risk ?? {}
    for (const key of ['breaking', 'permissionChange', 'migration', 'agentBehaviorChange']) {
      if (typeof risk[key] !== 'boolean') throw new BadRequestException(`risk.${key} 必须是 boolean`)
    }
    if (!input.testPlan || Object.keys(input.testPlan).length === 0) {
      throw new BadRequestException('提议必须带测试计划')
    }
    if (!input.rollbackPlan || !input.rollbackPlan.strategy) {
      throw new BadRequestException('提议必须带回退计划策略')
    }
  }

  async validateProposal(
    id: string,
    organizationId: string,
    extra?: { blueprintId?: string; previewUrl?: string; releaseId?: string; modelId?: string; eval?: { suite: string; passed: number; failed: number; writeUnconfirmed?: number; previous?: { passed: number; failed: number } | null } },
  ): Promise<AppChangeProposal> {
    const proposal = await this.proposals.findOne({ where: { id, organizationId } })
    if (!proposal) throw new NotFoundException('提议不存在')
    if (!['draft', 'submitted', 'validating'].includes(proposal.status)) {
      throw new ConflictException(`提议状态 ${proposal.status} 不能进入 validated`)
    }
    const validation = await this.validation.validate({
      proposal,
      organizationId,
      appKey: proposal.appKey,
      blueprintId: extra?.blueprintId,
      previewUrl: extra?.previewUrl,
      releaseId: extra?.releaseId ?? proposal.baseReleaseId ?? undefined,
      modelId: extra?.modelId,
      eval: extra?.eval,
    })
    if (!validation.ok) {
      proposal.status = 'draft'
      proposal.risk = { ...proposal.risk, gates: validation.gates }
      return this.proposals.save(proposal)
    }
    proposal.status = 'validated'
    proposal.risk = { ...proposal.risk, gates: validation.gates }
    return this.proposals.save(proposal)
  }

  async approveProposal(input: {
    id: string
    organizationId: string
    approverId: string
    role: 'owner' | 'tech_lead' | 'security' | 'platform_admin'
    comment?: string
    modifiedDiff?: Record<string, unknown>
  }): Promise<AppChangeProposal> {
    const proposal = await this.proposals.findOne({ where: { id: input.id, organizationId: input.organizationId } })
    if (!proposal) throw new NotFoundException('提议不存在')
    try {
      assertApproverDistinct({
        createdBy: proposal.createdBy,
        createdByAgent: proposal.createdByAgent,
        approverId: input.approverId,
      })
      assertEvolutionBinding({
        platformVersion: proposal.platformVersion,
        evolutionScope: proposal.evolutionScope,
      })
    } catch (error) {
      throw new ConflictException((error as Error).message)
    }
    if (!canTransitionProposal(proposal.status, 'approved')) {
      throw new ConflictException(`提议状态 ${proposal.status} 不能批准`)
    }
    const risk = proposal.risk ?? {}
    const needsSecond = needsSecondApprover(risk)
    if (needsSecond && !['security', 'tech_lead'].includes(input.role)) {
      throw new ConflictException('高风险变更需要安全或技术负责人审批')
    }
    if (input.modifiedDiff) {
      proposal.risk = { ...risk, originalDiff: proposal.diff, modifiedBy: input.approverId }
      proposal.diff = input.modifiedDiff
      const revalidation = await this.validation.validate({
        proposal,
        organizationId: proposal.organizationId,
        appKey: proposal.appKey,
        releaseId: proposal.baseReleaseId ?? undefined,
      })
      if (!revalidation.ok) {
        proposal.risk = { ...proposal.risk, gates: revalidation.gates }
        await this.proposals.save(proposal)
        throw new ConflictException('修改 diff 后重新校验未通过，不能批准')
      }
    }
    proposal.status = 'approved'
    proposal.approvedBy = input.approverId
    proposal.approvedAt = new Date()
    await this.approvals.save(
      this.approvals.create({
        proposalId: proposal.id,
        approverId: input.approverId,
        role: input.role,
        decision: 'approved',
        comment: input.comment ?? null,
      }),
    )
    return this.proposals.save(proposal)
  }

  async createProposalFromAiModule(input: { organizationId: string; aiModuleId: string; draftId: string; createdBy?: string | null }) {
    const module = await this.aiModules.findOne(input.aiModuleId, input.organizationId)
    const definition = await this.aiModules.getDefinition(input.aiModuleId)
    const draft = await this.getDraft(input.draftId, input.organizationId)
    return this.createProposal({
      organizationId: input.organizationId,
      appKey: draft.appKey,
      draftId: draft.id,
      type: 'form',
      areas: ['form'],
      title: module.name,
      summary: module.description ?? 'AI module update',
      diff: { source: 'ai_module', moduleId: module.id, definition: definition ?? null },
      evidence: [{ type: 'ai_module', ids: [module.id] }],
      risk: { breaking: false, permissionChange: false, migration: false, agentBehaviorChange: false },
      testPlan: { unit: ['ai-module-lifecycle.spec.ts'] },
      rollbackPlan: { strategy: 'deactivate-release', dataSafe: true },
      platformVersion:
        typeof draft.content?.platformVersion === 'string'
          ? draft.content.platformVersion
          : null,
      evolutionScope: Array.isArray(draft.content?.evolutionScope)
        ? (draft.content.evolutionScope as string[])
        : null,
      createdByAgent: null,
      createdBy: input.createdBy ?? null,
    })
  }

  /** 实例回流前的脱敏检查；命中项逐条返回，不静默放行。 */
  checkBackflow(text: string) {
    return redactBackflow(text)
  }

  /** 平台升级与实例改动的三方冲突检测；冲突时 compatible=false。 */
  checkUpgradeConflicts(input: {
    base: Record<string, unknown>
    instance: Record<string, unknown>
    next: Record<string, unknown>
  }) {
    return checkUpgradeConflicts(input)
  }

  /**
   * 回流路径第一步：实例提议 → 脱敏后的平台评审包。
   * 不自动创建平台版本；返回明确的下一步与人工审批要求。
   */
  async prepareBackflow(id: string, organizationId: string) {
    const proposal = await this.getProposal(id, organizationId)
    const payload = {
      title: proposal.title,
      summary: proposal.summary,
      diff: proposal.diff,
      testPlan: proposal.testPlan,
      rollbackPlan: proposal.rollbackPlan,
      platformVersion: proposal.platformVersion,
      evolutionScope: proposal.evolutionScope,
    }
    const redacted = redactBackflow(JSON.stringify(payload))
    return {
      proposalId: proposal.id,
      appKey: proposal.appKey,
      safe: redacted.safe,
      findings: redacted.findings,
      redacted: JSON.parse(redacted.text),
      next: 'platform-review',
      requiresManualApproval: true,
      target: 'platform-template-or-rule-package',
    }
  }

  async getProposal(id: string, organizationId: string): Promise<AppChangeProposal> {
    const proposal = await this.proposals.findOne({ where: { id, organizationId } })
    if (!proposal) throw new NotFoundException('提议不存在')
    return proposal
  }

  async rejectProposal(input: {
    id: string
    organizationId: string
    approverId: string
    role: 'owner' | 'tech_lead' | 'security' | 'platform_admin'
    reason: string
  }): Promise<AppChangeProposal> {
    if (!input.reason?.trim()) throw new BadRequestException('驳回时必须填写原因')
    const proposal = await this.proposals.findOne({ where: { id: input.id, organizationId: input.organizationId } })
    if (!proposal) throw new NotFoundException('提议不存在')
    proposal.status = 'rejected'
    await this.approvals.save(
      this.approvals.create({
        proposalId: proposal.id,
        approverId: input.approverId,
        role: input.role,
        decision: 'rejected',
        comment: input.reason,
      }),
    )
    return this.proposals.save(proposal)
  }

  async publish(input: {
    organizationId: string | null
    appKey: string
    version: string
    channel: 'preview' | 'canary' | 'stable'
    manifest: Record<string, unknown>
    changelog: Record<string, unknown>
    compatibility?: Record<string, unknown>
    migrations?: Array<{ id: string; rollbackSafe?: boolean }>
    authorId?: string | null
    approverId?: string | null
    publishedBy?: string | null
    emergency?: boolean
  }): Promise<AppRelease> {
    assertEnabled()
    /**
     * 发布包的形状校验由 libs/release-kernel 负责，那里抛的是普通 Error，
     * 直接往上抛会被全局过滤器包成 500「Internal Server Error」，
     * 调用方看不出是入参问题。这里统一转成 400。
     */
    try {
      assertPublishable({
        version: input.version,
        channel: input.channel,
        manifest: input.manifest,
        changelog: input.changelog,
        compatibility: input.compatibility,
        migrations: input.migrations,
        authorId: input.authorId,
        approverId: input.approverId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const hint = message.includes('zh-CN')
        ? '；changelog 形如 { "zh-CN": [{ "type": "changed", "title": "..." }] }'
        : ''
      throw new BadRequestException(`${message}${hint}`)
    }
    const digest = computeReleaseDigest(input.manifest)
    const signature = process.env.RELEASE_SIGNING_PRIVATE_KEY_PEM ? `ed25519:${digest}` : 'unsigned:dev'
    const release = await this.releases.save(
      this.releases.create({
        organizationId: input.organizationId,
        appKey: input.appKey,
        version: input.version,
        channel: input.channel,
        status: 'published',
        baseReleaseId: null,
        manifest: input.manifest,
        changelog: input.changelog,
        compatibility: input.compatibility ?? {},
        digest,
        signature,
        publishedAt: new Date(),
        publishedBy: input.publishedBy ?? null,
        createdBy: input.publishedBy ?? null,
      }),
    )
    await this.events.save(
      this.events.create({
        releaseId: release.id,
        organizationId: input.organizationId,
        event: 'release.published',
        actorId: input.publishedBy ?? null,
        actorAgent: null,
        payload: { version: input.version, channel: input.channel, digest, emergency: input.emergency === true },
      }),
    )
    return release
  }

  async activate(input: {
    organizationId: string
    appInstallationId: string
    releaseId: string
    action?: 'activate' | 'upgrade' | 'rollback'
    cohort?: Record<string, unknown> | null
    activatedBy?: string | null
    reason?: string | null
    fromReleaseId?: string | null
  }): Promise<AppReleaseActivation> {
    assertEnabled()
    const release = await this.releases.findOne({ where: { id: input.releaseId } })
    if (!release) throw new NotFoundException('Release 不存在')
    if (release.status === 'revoked') throw new ConflictException('Release 已被吊销')
    if (release.status !== 'published') throw new ConflictException('只有 published Release 可以激活')
    if (!input.cohort) {
      const active = await this.activations.findOne({
        where: { appInstallationId: input.appInstallationId, status: 'active' },
      })
      if (active) throw new ConflictException('同一安装已存在 active Release')
    }
    const activation = await this.activations.save(
      this.activations.create({
        organizationId: input.organizationId,
        appInstallationId: input.appInstallationId,
        releaseId: input.releaseId,
        action: input.action ?? 'activate',
        status: 'active',
        cohort: input.cohort ?? null,
        effectiveAt: new Date(),
        activatedAt: new Date(),
        activatedBy: input.activatedBy ?? null,
        reason: input.reason ?? null,
        fromReleaseId: input.fromReleaseId ?? null,
      }),
    )
    await this.events.save(
      this.events.create({
        releaseId: input.releaseId,
        organizationId: input.organizationId,
        event: input.action === 'rollback' ? 'release.rolled_back' : 'release.activated',
        actorId: input.activatedBy ?? null,
        actorAgent: null,
        payload: { appInstallationId: input.appInstallationId, cohort: input.cohort ?? null },
      }),
    )
    await this.cache.bumpActiveVersion(input.organizationId, release.appKey)
    if (input.activatedBy) {
      await this.notifications.save(
        this.notifications.create({
          organizationId: input.organizationId,
          userId: input.activatedBy,
          type: 'info',
          title: `Release ${release.version} activated`,
          body: `应用 ${release.appKey} 已激活版本 ${release.version}`,
          read: false,
          sourceEventId: activation.id,
          metadata: { releaseId: release.id, appKey: release.appKey },
        }),
      )
    }
    await this.outbox.publish(this.dataSource.manager, {
      topic: input.action === 'rollback' ? 'release.rolled_back' : 'release.activated',
      payload: { releaseId: input.releaseId, appInstallationId: input.appInstallationId, cohort: input.cohort ?? null },
      organizationId: input.organizationId,
      idempotencyKey: `release:activation:${activation.id}`,
      aggregateType: 'app_release_activation',
      aggregateId: activation.id,
    })
    return activation
  }

  async rollback(input: {
    organizationId: string
    appInstallationId: string
    releaseId: string
    activatedBy?: string | null
    reason: string
  }): Promise<AppReleaseActivation> {
    const release = await this.releases.findOne({ where: { id: input.releaseId } })
    if (!release) throw new NotFoundException('目标 Release 不存在')
    if (release.status === 'revoked') throw new ConflictException('目标 Release 已吊销')
    if (release.compatibility?.rollbackSafe === false) {
      throw new ConflictException('目标 Release 数据不兼容，禁止回退')
    }
    const current = await this.activations.findOne({
      where: { appInstallationId: input.appInstallationId, status: 'active' },
    })
    if (current) {
      current.status = 'rolled_back'
      await this.activations.save(current)
    }
    return this.activate({
      organizationId: input.organizationId,
      appInstallationId: input.appInstallationId,
      releaseId: input.releaseId,
      action: 'rollback',
      activatedBy: input.activatedBy ?? null,
      reason: input.reason,
      fromReleaseId: current?.releaseId ?? null,
    })
  }

  async activeRelease(organizationId: string, appInstallationId: string): Promise<AppRelease | null> {
    const activation = await this.activations.findOne({
      where: { organizationId, appInstallationId, status: 'active' },
      order: { activatedAt: 'DESC' },
    })
    if (!activation) return null
    return this.releases.findOne({ where: { id: activation.releaseId } })
  }

  async whatsNew(organizationId: string, appInstallationId: string, userId: string) {
    const release = await this.activeRelease(organizationId, appInstallationId)
    if (!release) return { release: null, items: [], unread: false }
    const view = await this.views.findOne({ where: { organizationId, userId, appInstallationId } })
    return {
      release: {
        id: release.id,
        version: release.version,
        channel: release.channel,
        changelog: release.changelog,
      },
      items: await this.items.find({ where: { releaseId: release.id } }),
      unread: !view || view.lastSeenReleaseId !== release.id,
    }
  }

  async markWhatsNewRead(input: {
    organizationId: string
    appInstallationId: string
    userId: string
    releaseId: string
  }): Promise<AppUserReleaseView> {
    const existing = await this.views.findOne({
      where: {
        organizationId: input.organizationId,
        userId: input.userId,
        appInstallationId: input.appInstallationId,
      },
    })
    if (existing) {
      existing.lastSeenReleaseId = input.releaseId
      existing.lastSeenAt = new Date()
      return this.views.save(existing)
    }
    return this.views.save(
      this.views.create({
        organizationId: input.organizationId,
        userId: input.userId,
        appInstallationId: input.appInstallationId,
        lastSeenReleaseId: input.releaseId,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      }),
    )
  }

  issuePreviewToken(input: {
    userId: string
    organizationId: string
    releaseId: string
    roles: string[]
    ttlSeconds?: number
  }): string {
    const exp = Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 3600)
    const payload = Buffer.from(
      JSON.stringify({
        userId: input.userId,
        organizationId: input.organizationId,
        releaseId: input.releaseId,
        roles: input.roles,
        exp,
      }),
    ).toString('base64url')
    const sig = createHmac('sha256', previewSecret()).update(payload).digest('base64url')
    return `${payload}.${sig}`
  }

  verifyPreviewToken(token: string, expected: { organizationId: string; releaseId?: string }) {
    const [payload, sig] = token.split('.')
    if (!payload || !sig) throw new ForbiddenException('预览 token 非法')
    const actual = createHmac('sha256', previewSecret()).update(payload).digest('base64url')
    if (actual.length !== sig.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(sig))) {
      throw new ForbiddenException('预览 token 签名不匹配')
    }
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      organizationId: string
      releaseId: string
      exp: number
    }
    if (claims.exp < Math.floor(Date.now() / 1000)) throw new ForbiddenException('预览 token 已过期')
    if (claims.organizationId !== expected.organizationId) throw new ForbiddenException('预览 token 组织不匹配')
    if (expected.releaseId && claims.releaseId !== expected.releaseId) {
      throw new ForbiddenException('预览 token Release 不匹配')
    }
    return claims
  }

  async impact(releaseId: string): Promise<{ items: AppReleaseItem[]; diff: ReturnType<typeof diffPlainObject> }> {
    const release = await this.releases.findOne({ where: { id: releaseId } })
    if (!release) throw new NotFoundException('Release 不存在')
    const items = await this.items.find({ where: { releaseId } })
    return { items, diff: diffPlainObject({}, release.manifest) }
  }

  async listReleases(organizationId: string, appKey?: string): Promise<AppRelease[]> {
    const where: Record<string, unknown> = { organizationId }
    if (appKey) where.appKey = appKey
    return this.releases.find({ where, order: { createdAt: 'DESC' }, take: 100 })
  }

  /**
   * 提议列表。管理端需要有入口看到「有哪些提议待审批」，
   * 否则只能拿着 id 直接访问详情页。
   */
  async listProposals(organizationId: string, appKey?: string, status?: string): Promise<AppChangeProposal[]> {
    const where: Record<string, unknown> = { organizationId }
    if (appKey) where.appKey = appKey
    if (status) where.status = status
    return this.proposals.find({ where, order: { createdAt: 'DESC' }, take: 100 })
  }

  async releaseStatus(releaseId: string): Promise<AppRelease> {
    const release = await this.releases.findOne({ where: { id: releaseId } })
    if (!release) throw new NotFoundException('Release 不存在')
    return release
  }
}
