import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash, randomUUID } from 'node:crypto'
import { DataSource, Repository } from 'typeorm'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { ReviewEvent } from '../review/review-event.entity'
import {
  AiContentLabel,
  AiContentProvenance,
  AiContentType,
  AiScoreRecord,
  ContentLabelType,
} from './ai-governance.entities'
import { contentSafetyCheck } from './content-safety.provider'
import { NotificationService } from '../websocket/services/notification.service'

export interface GovernanceActor {
  id: string
  permissions: string[]
}

export interface ProvenanceInput {
  contentId: string
  contentType: AiContentType
  producer: string
  content: string
  agent?: string | null
  model?: string | null
  prompt?: string | null
  templateRef?: string | null
  taskId?: string | null
  parentContentId?: string | null
  metadata?: Record<string, unknown> | null
}

const LABEL_TEXT = () => process.env.AI_CONTENT_LABEL_TEXT || 'AI 生成内容'

@Injectable()
export class AiGovernanceService {
  constructor(
    @InjectRepository(AiContentProvenance)
    private readonly provenance: Repository<AiContentProvenance>,
    @InjectRepository(AiContentLabel)
    private readonly labels: Repository<AiContentLabel>,
    @InjectRepository(AiScoreRecord)
    private readonly scores: Repository<AiScoreRecord>,
    @InjectRepository(BlueprintApproval)
    private readonly approvals: Repository<BlueprintApproval>,
    @InjectRepository(ReviewEvent)
    private readonly events: Repository<ReviewEvent>,
    private readonly dataSource: DataSource,
    private readonly auditLogs: AuditLogsService,
    private readonly notifications?: NotificationService,
  ) {}

  async recordProvenance(
    organizationId: string,
    actor: GovernanceActor,
    input: ProvenanceInput,
  ): Promise<AiContentProvenance> {
    if (!input.contentId) throw new BadRequestException('contentId 必填')
    if (!input.content) throw new BadRequestException('content 必填')
    const version = await this.nextVersion(input.contentId, organizationId)
    const saved = await this.provenance.save(
      this.provenance.create({
        organizationId,
        contentId: input.contentId,
        contentType: input.contentType,
        producer: input.producer,
        agent: input.agent ?? null,
        model: input.model ?? null,
        promptHash: input.prompt
          ? createHash('sha256').update(input.prompt).digest('hex')
          : null,
        templateRef: input.templateRef ?? null,
        taskId: input.taskId ?? null,
        contentHash: createHash('sha256').update(input.content).digest('hex'),
        parentContentId: input.parentContentId ?? null,
        version,
        metadata: input.metadata ?? null,
      }),
    )
    await this.audit(organizationId, actor, 'ai.provenance', {
      contentId: input.contentId,
      contentType: input.contentType,
      version,
      parentContentId: input.parentContentId ?? null,
    })
    return saved
  }

  async listProvenance(organizationId: string, contentId: string) {
    const rows = await this.provenance.find({
      where: { organizationId, contentId },
      order: { version: 'DESC' },
    })
    if (rows.length === 0) throw new NotFoundException('内容溯源不存在')
    return rows
  }

  async applyLabel(
    organizationId: string,
    actor: GovernanceActor,
    input: { contentId: string; labelType: ContentLabelType; text?: string },
  ): Promise<AiContentLabel> {
    const version = await this.nextLabelVersion(input.contentId, input.labelType, organizationId)
    const text = input.text?.trim() || LABEL_TEXT()
    const metadata = {
      contentId: input.contentId,
      labelType: input.labelType,
      labelVersion: version,
      appliedBy: actor.id,
      text,
    }
    const saved = await this.labels.save(
      this.labels.create({
        organizationId,
        contentId: input.contentId,
        labelType: input.labelType,
        version,
        text,
        status: 'applied',
        metadata,
        appliedAt: new Date(),
        verifiedAt: null,
      }),
    )
    await this.audit(organizationId, actor, 'ai.label.apply', {
      contentId: input.contentId,
      labelType: input.labelType,
      version,
    })
    return saved
  }

  async verifyLabel(
    organizationId: string,
    actor: GovernanceActor,
    input: { contentId: string; labelType: ContentLabelType },
  ): Promise<{ valid: boolean; reason?: string; label?: AiContentLabel }> {
    const label = await this.labels.findOne({
      where: {
        organizationId,
        contentId: input.contentId,
        labelType: input.labelType,
      },
      order: { version: 'DESC' },
    })
    if (!label) return { valid: false, reason: 'label_missing' }
    if (label.status !== 'applied') return { valid: false, reason: 'label_not_applied', label }
    if (!label.text?.trim()) return { valid: false, reason: 'label_empty', label }
    label.verifiedAt = new Date()
    await this.labels.save(label)
    await this.audit(organizationId, actor, 'ai.label.verify', {
      contentId: input.contentId,
      labelType: input.labelType,
      version: label.version,
    })
    return { valid: true, label }
  }

  async listLabels(organizationId: string, contentId: string): Promise<AiContentLabel[]> {
    return this.labels.find({
      where: { organizationId, contentId },
      order: { labelType: 'ASC', version: 'DESC' },
    })
  }

  async submitForReview(
    organizationId: string,
    actor: GovernanceActor,
    input: { contentId: string; text: string },
  ): Promise<{ round: number; safety: { status: string; evidence: Record<string, unknown> } }> {
    const previous = await this.approvals.find({
      where: { organizationId, recordId: input.contentId, ruleId: 'ai-content-final' },
      order: { round: 'DESC' },
    })
    const round = (previous[0]?.round ?? 0) + 1
    const steps = [
      {
        role: 'check',
        kind: 'check' as const,
        checkProvider: 'content-safety',
        finalStep: false,
      },
      {
        role: 'content-reviewer',
        kind: 'human' as const,
        checkProvider: null,
        finalStep: false,
      },
      {
        role: 'content-final-reviewer',
        kind: 'human' as const,
        checkProvider: null,
        finalStep: true,
      },
    ]
    const safety = await this.runSafety(input.text)
    let firstApprovalId = ''
    for (const [index, step] of steps.entries()) {
      const savedApproval: any = await this.approvals.save(
        this.approvals.create({
          organizationId,
          blueprintId: 'ai-content-governance',
          blueprintVersion: '1',
          entity: 'AiContent',
          recordId: input.contentId,
          ruleId: 'ai-content-final',
          round,
          stepIndex: index,
          role: step.role,
          kind: step.kind,
          selector: step.kind === 'human' ? { kind: 'role', role: step.role } : null,
          assignee: null,
          checkProvider: step.checkProvider,
          checkResult:
            step.kind === 'check'
              ? { status: safety.status, evidence: safety.evidence }
              : null,
          comment: null,
          decidedBy: null,
          dueAt: null,
          reminderSentAt: null,
          escalatedAt: null,
          subjectAuthor: actor.id,
          finalStep: step.finalStep,
          status:
            step.kind === 'check'
              ? safety.status === 'pass'
                ? 'approved'
                : safety.status === 'fail'
                  ? 'rejected'
                  : 'pending'
              : 'pending',
        }) as never,
      )
      if (index === 0) firstApprovalId = savedApproval.id
    }
    await this.events.save(
      this.events.create({
        organizationId,
        approvalId: firstApprovalId,
        recordId: input.contentId,
        type: 'submit',
        actorId: actor.id,
        payload: { round, safety },
      }),
    )
    await this.audit(organizationId, actor, 'ai.review.submit', {
      contentId: input.contentId,
      round,
      safety: safety.status,
    })
    const reviewers = (await this.dataSource.query(
      `SELECT "userId" FROM public.organization_member_roles
        WHERE "organizationId" = $1 AND "roleName" = 'content-reviewer' AND status = 'active'`,
      [organizationId],
    )) as Array<{ userId: string }>
    for (const reviewer of reviewers) {
      await this.notifications?.sendToUser(
        reviewer.userId,
        {
          organizationId,
          type: safety.status === 'fail' ? 'error' : 'info',
          title: 'AI 内容待复核',
          message: `内容 ${input.contentId} 已提交终审（检测：${safety.status}）`,
          category: 'approval',
          priority: 'high',
          actionUrl: '/admin/ai-governance',
          data: { contentId: input.contentId, round },
        },
        randomUUID(),
      )
    }
    return { round, safety }
  }

  async gate(organizationId: string, contentId: string): Promise<{
    allowed: boolean
    reason?: string
    round?: number
  }> {
    const provenance = await this.provenance.findOne({
      where: { organizationId, contentId },
      order: { version: 'DESC' },
    })
    if (!provenance) return { allowed: true, reason: 'non-ai-content' }
    const labels = await this.labels.find({
      where: { organizationId, contentId },
    })
    for (const type of ['explicit', 'implicit'] as const) {
      const latest = labels
        .filter((label) => label.labelType === type)
        .sort((a, b) => b.version - a.version)[0]
      if (!latest || latest.status !== 'applied') {
        return { allowed: false, reason: `label_missing:${type}` }
      }
    }
    const approvals = await this.approvals.find({
      where: { organizationId, recordId: contentId, ruleId: 'ai-content-final' },
      order: { round: 'DESC', stepIndex: 'ASC' },
    })
    if (approvals.length === 0) return { allowed: false, reason: 'review-required' }
    const round = approvals[0].round
    const latest = approvals.filter((row) => row.round === round)
    if (latest.some((row) => row.status !== 'approved')) {
      const pending = latest.find((row) => row.status !== 'approved')
      return {
        allowed: false,
        reason: `review-pending:${pending?.kind}:${pending?.stepIndex}`,
        round,
      }
    }
    return { allowed: true, round }
  }

  async assertPublishable(organizationId: string, contentId: string): Promise<void> {
    const result = await this.gate(organizationId, contentId)
    if (!result.allowed) throw new ForbiddenException(result.reason ?? 'AI 内容治理未通过')
  }

  async createScore(
    organizationId: string,
    actor: GovernanceActor,
    input: {
      contentId?: string | null
      subjectType: string
      subjectId: string
      aiScore?: number | null
      ruleVersion?: string | null
      metadata?: Record<string, unknown> | null
    },
  ): Promise<AiScoreRecord> {
    const saved = await this.scores.save(
      this.scores.create({
        organizationId,
        contentId: input.contentId ?? null,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        aiScore:
          input.aiScore === null || input.aiScore === undefined
            ? null
            : String(input.aiScore),
        humanScore: null,
        status: 'ai_only',
        ruleVersion: input.ruleVersion ?? null,
        metadata: input.metadata ?? null,
      }),
    )
    await this.audit(organizationId, actor, 'ai.score', {
      scoreId: saved.id,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    })
    return saved
  }

  async confirmScore(
    organizationId: string,
    actor: GovernanceActor,
    id: string,
    humanScore: number,
  ): Promise<AiScoreRecord> {
    const row = await this.getScore(organizationId, id)
    row.humanScore = String(humanScore)
    row.status = 'teacher_confirmed'
    row.confirmedBy = actor.id
    row.confirmedAt = new Date()
    const saved = await this.scores.save(row)
    await this.audit(organizationId, actor, 'ai.score.confirm', {
      scoreId: id,
      humanScore,
    })
    return saved
  }

  async appealScore(
    organizationId: string,
    actor: GovernanceActor,
    id: string,
    reason: string,
  ): Promise<AiScoreRecord> {
    const row = await this.getScore(organizationId, id)
    if (row.status === 'final') throw new ConflictException('已终审评分不能申诉')
    row.status = 'appealed'
    row.appealReason = reason
    const saved = await this.scores.save(row)
    await this.audit(organizationId, actor, 'ai.score.appeal', { scoreId: id, reason })
    return saved
  }

  async finalizeScore(
    organizationId: string,
    actor: GovernanceActor,
    id: string,
  ): Promise<AiScoreRecord> {
    const row = await this.getScore(organizationId, id)
    if (!['teacher_confirmed', 'appealed'].includes(row.status)) {
      throw new ConflictException('只有教师确认/申诉后的评分可以终审')
    }
    if (row.confirmedBy === actor.id && row.status === 'teacher_confirmed') {
      throw new ForbiddenException('确认人不能自我终审')
    }
    row.status = 'final'
    const saved = await this.scores.save(row)
    await this.audit(organizationId, actor, 'ai.score.final', { scoreId: id })
    return saved
  }

  async listScores(
    organizationId: string,
    filter: { subjectType?: string; subjectId?: string; contentId?: string },
  ): Promise<AiScoreRecord[]> {
    return this.scores.find({
      where: {
        organizationId,
        ...(filter.subjectType ? { subjectType: filter.subjectType } : {}),
        ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
        ...(filter.contentId ? { contentId: filter.contentId } : {}),
      },
      order: { createdAt: 'DESC' },
    })
  }

  async confirmRule(
    organizationId: string,
    actor: GovernanceActor,
    input: { subjectType: string; subjectId: string; ruleVersion: string },
  ): Promise<AiScoreRecord> {
    const saved = await this.scores.save(
      this.scores.create({
        organizationId,
        contentId: null,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        aiScore: null,
        humanScore: null,
        status: 'ai_only',
        ruleVersion: input.ruleVersion,
        metadata: {
          kind: 'rule-confirmation',
          ruleVersion: input.ruleVersion,
          confirmedBy: actor.id,
          confirmedAt: new Date().toISOString(),
        },
      }),
    )
    await this.audit(organizationId, actor, 'ai.score.confirm', {
      kind: 'rule-confirmation',
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      ruleVersion: input.ruleVersion,
    })
    return saved
  }

  async hasConfirmedRule(
    organizationId: string,
    subjectType: string,
    subjectId: string,
    ruleVersion: string,
  ): Promise<boolean> {
    const rows = await this.scores.find({
      where: { organizationId, subjectType, subjectId },
      order: { createdAt: 'DESC' },
      take: 20,
    })
    return rows.some(
      (row) =>
        row.metadata?.kind === 'rule-confirmation' &&
        row.metadata?.ruleVersion === ruleVersion,
    )
  }

  private async runSafety(text: string) {
    const mode = (process.env.AI_CONTENT_SAFETY_MODE || 'strict').toLowerCase()
    if (mode === 'off') {
      return {
        status: 'pass' as const,
        evidence: { provider: 'content-safety', reason: 'provider-disabled' },
      }
    }
    const result = await contentSafetyCheck({ text, mode: 'output' })
    if (mode === 'warn' && result.status === 'fail') {
      return { status: 'warn' as const, evidence: { ...result.evidence, downgraded: true } }
    }
    return result
  }

  private async getScore(organizationId: string, id: string): Promise<AiScoreRecord> {
    const row = await this.scores.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('评分记录不存在')
    return row
  }

  private async nextVersion(contentId: string, organizationId: string): Promise<number> {
    const rows = await this.provenance.find({
      where: { contentId, organizationId },
      order: { version: 'DESC' },
      take: 1,
    })
    return (rows[0]?.version ?? 0) + 1
  }

  private async nextLabelVersion(
    contentId: string,
    labelType: ContentLabelType,
    organizationId: string,
  ): Promise<number> {
    const rows = await this.labels.find({
      where: { contentId, labelType, organizationId },
      order: { version: 'DESC' },
      take: 1,
    })
    return (rows[0]?.version ?? 0) + 1
  }

  private async audit(
    organizationId: string,
    actor: GovernanceActor,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLogs.create({
      organizationId,
      action,
      resource: 'ai_content',
      actor: actor.id,
      status: 'success',
      metadata,
      source: 'ai-governance',
    })
  }
}
