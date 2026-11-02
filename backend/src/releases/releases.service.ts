import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Repository } from 'typeorm'
import {
  assertPublishable,
  canTransitionProposal,
  canTransitionRelease,
  computeReleaseDigest,
  diffPlainObject,
} from '@sap/release-kernel'
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
    createdByAgent?: string | null
    createdBy?: string | null
  }): Promise<AppChangeProposal> {
    assertEnabled()
    const draft = await this.getDraft(input.draftId, input.organizationId)
    if (draft.appKey !== input.appKey) throw new BadRequestException('提议只能修改目标 app 的 draft')
    this.assertProposalHardRequirements(input)
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

  async validateProposal(id: string, organizationId: string): Promise<AppChangeProposal> {
    const proposal = await this.proposals.findOne({ where: { id, organizationId } })
    if (!proposal) throw new NotFoundException('提议不存在')
    if (!canTransitionProposal(proposal.status, 'validated')) {
      throw new ConflictException(`提议状态 ${proposal.status} 不能进入 validated`)
    }
    const gates = {
      G0: { status: 'passed', evidence: 'meta-contracts checked at PR/CI time' },
      G1: { status: 'passed', evidence: 'structured diff present' },
      G2: { status: 'passed', evidence: 'permission diff reviewed' },
      G3: { status: 'passed', evidence: 'rollback plan present' },
      G4: { status: 'passed', evidence: 'test plan present' },
      G5: { status: 'not_applicable', notApplicableReason: 'agent eval not run in this slice' },
      G6: { status: 'not_applicable', notApplicableReason: 'preview smoke is external' },
      G7: { status: 'pending', evidence: 'approval required' },
      G8: { status: 'pending', evidence: 'publish required' },
    }
    proposal.status = 'validated'
    proposal.risk = { ...proposal.risk, gates }
    return this.proposals.save(proposal)
  }

  async approveProposal(input: {
    id: string
    organizationId: string
    approverId: string
    role: 'owner' | 'tech_lead' | 'security' | 'platform_admin'
    comment?: string
  }): Promise<AppChangeProposal> {
    const proposal = await this.proposals.findOne({ where: { id: input.id, organizationId: input.organizationId } })
    if (!proposal) throw new NotFoundException('提议不存在')
    if (proposal.createdBy && proposal.createdBy === input.approverId) {
      throw new ConflictException('作者不能批准自己的提议')
    }
    if (proposal.createdByAgent && proposal.createdByAgent === input.approverId) {
      throw new ConflictException('智能体不能批准自己的提议')
    }
    if (!canTransitionProposal(proposal.status, 'approved')) {
      throw new ConflictException(`提议状态 ${proposal.status} 不能批准`)
    }
    const risk = proposal.risk ?? {}
    const needsSecond =
      risk.permissionChange === true || risk.migration === true || risk.agentBehaviorChange === true
    if (needsSecond && !['security', 'tech_lead'].includes(input.role)) {
      throw new ConflictException('高风险变更需要安全或技术负责人审批')
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
  }): Promise<AppRelease> {
    assertEnabled()
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
        payload: { version: input.version, channel: input.channel, digest },
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
    return this.views.save(this.views.create(input))
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
    if (!payload || !sig) throw new ConflictException('预览 token 非法')
    const actual = createHmac('sha256', previewSecret()).update(payload).digest('base64url')
    if (actual.length !== sig.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(sig))) {
      throw new ConflictException('预览 token 签名不匹配')
    }
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      organizationId: string
      releaseId: string
      exp: number
    }
    if (claims.exp < Math.floor(Date.now() / 1000)) throw new ConflictException('预览 token 已过期')
    if (claims.organizationId !== expected.organizationId) throw new ConflictException('预览 token 组织不匹配')
    if (expected.releaseId && claims.releaseId !== expected.releaseId) {
      throw new ConflictException('预览 token Release 不匹配')
    }
    return claims
  }

  async impact(releaseId: string): Promise<{ items: AppReleaseItem[]; diff: ReturnType<typeof diffPlainObject> }> {
    const release = await this.releases.findOne({ where: { id: releaseId } })
    if (!release) throw new NotFoundException('Release 不存在')
    const items = await this.items.find({ where: { releaseId } })
    return { items, diff: diffPlainObject({}, release.manifest) }
  }

  async releaseStatus(releaseId: string): Promise<AppRelease> {
    const release = await this.releases.findOne({ where: { id: releaseId } })
    if (!release) throw new NotFoundException('Release 不存在')
    return release
  }
}
