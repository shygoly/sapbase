import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { ReviewComment } from './review-comment.entity'
import { ReviewEvent } from './review-event.entity'
import { WorkItemsService } from './work-items.service'
import { ReviewDelegationService } from './review-delegation.service'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { normalizeSelector, selectorMatchesActor, type AssigneeActor } from './assignee-selector'

export type ReviewDecisionAction = 'approve' | 'reject' | 'request-changes'

export interface ReviewDecisionActor extends AssigneeActor {
  userId: string
}

/**
 * 人工动作：approve / reject / request-changes。
 *
 * 只有当前 pending 步骤的合法审批人可操作；selector/assignee/role 任一配置存在
 * 都必须满足。动作写 review_events，并关闭对应 work_item。
 */
@Injectable()
export class ReviewDecisionService {
  constructor(
    @InjectRepository(BlueprintApproval)
    private readonly approvals: Repository<BlueprintApproval>,
    @InjectRepository(ReviewEvent)
    private readonly events: Repository<ReviewEvent>,
    @InjectRepository(ReviewComment)
    private readonly comments: Repository<ReviewComment>,
    private readonly workItems: WorkItemsService,
    @Optional() private readonly delegations?: ReviewDelegationService,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  async act(
    organizationId: string,
    approvalId: string,
    actor: ReviewDecisionActor,
    action: ReviewDecisionAction,
    comment?: string,
  ): Promise<BlueprintApproval> {
    const approval = await this.approvals.findOne({
      where: { id: approvalId, organizationId },
    })
    if (!approval) throw new NotFoundException('Approval step not found')
    if (approval.status !== 'pending') {
      throw new ConflictException(`审批步骤状态 ${approval.status} 不可操作`)
    }
    // 机器检测步骤不能被人工绕过：只有 warn 可由人工明确确认，且必须写理由。
    if (approval.kind === 'check') {
      const checkStatus = (approval.checkResult as { status?: string } | null)?.status
      if (checkStatus !== 'warn') {
        throw new ConflictException('机器检测尚未完成，不能人工操作该步骤')
      }
      if (action !== 'approve') {
        throw new ConflictException('warn 只能人工确认通过或由作者修改后重提')
      }
      if (!comment || !comment.trim()) {
        throw new ConflictException('warn 必须填写明确确认理由')
      }
    }
    let delegatedFrom: string | null = null
    if (!this.isAllowed(approval, actor)) {
      const delegation = await this.delegations?.findActive(
        organizationId,
        approvalId,
        actor.userId,
      )
      if (!delegation) {
        throw new ForbiddenException('不是当前步骤的合法审批人')
      }
      delegatedFrom = delegation.fromUserId
    }
    approval.status = action === 'approve' ? 'approved' : 'rejected'
    approval.actor = actor.userId
    approval.decidedBy = actor.userId
    approval.decidedAt = new Date()
    approval.comment = comment ?? approval.comment
    const saved = await this.approvals.save(approval)

    if (comment) {
      await this.comments.save(
        this.comments.create({
          organizationId,
          approvalId: approval.id,
          recordId: approval.recordId,
          authorId: actor.userId,
          body: comment,
          parentId: null,
          attachments: null,
          visibility: 'all',
        }),
      )
    }
    await this.events.save(
      this.events.create({
        organizationId,
        approvalId: approval.id,
        recordId: approval.recordId,
        type: action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'request_changes',
        actorId: actor.userId,
        payload: {
          comment: comment ?? null,
          round: approval.round,
          delegatedFrom,
        },
      }),
    )
    await this.workItems.close(organizationId, 'approval', approval.id)
    await this.auditLogs?.create({
      organizationId,
      action:
        action === 'approve'
          ? 'review.approve'
          : action === 'reject'
            ? 'review.reject'
            : 'review.request_changes',
      resource: 'approval',
      resourceId: approval.id,
      actor: actor.userId,
      status: 'success',
      metadata: {
        ruleId: approval.ruleId,
        recordId: approval.recordId,
        round: approval.round,
        stepIndex: approval.stepIndex,
        delegatedFrom,
      },
      source: 'review',
    })
    return saved
  }

  async resubmit(
    organizationId: string,
    approvalId: string,
    actor: ReviewDecisionActor,
    comment?: string,
  ): Promise<BlueprintApproval[]> {
    const anchor = await this.approvals.findOne({
      where: { id: approvalId, organizationId },
    })
    if (!anchor) throw new NotFoundException('Approval step not found')
    const rows = await this.approvals.find({
      where: {
        organizationId,
        recordId: anchor.recordId,
        ruleId: anchor.ruleId,
      },
      order: { round: 'DESC', stepIndex: 'ASC' },
    })
    const latestRound = rows[0]?.round ?? 1
    const latest = rows.filter((row) => row.round === latestRound)
    if (latest.some((row) => row.status === 'pending')) {
      throw new ConflictException('当前轮次仍有待审步骤，不能重提')
    }
    if (!latest.some((row) => this.isAllowed(row, actor))) {
      throw new ForbiddenException('不是当前轮次的合法审批人')
    }
    const nextRound = latestRound + 1
    const created: BlueprintApproval[] = []
    for (const row of latest) {
      const next = this.approvals.create({
        organizationId: row.organizationId,
        blueprintId: row.blueprintId,
        blueprintVersion: row.blueprintVersion,
        entity: row.entity,
        recordId: row.recordId,
        ruleId: row.ruleId,
        round: nextRound,
        stepIndex: row.stepIndex,
        role: row.role,
        kind: row.kind,
        selector: row.selector,
        assignee: row.assignee,
        checkProvider: row.checkProvider,
        dueAt: row.dueAt,
        status: 'pending',
        actor: null,
        decidedBy: null,
        decidedAt: null,
        comment: null,
        checkResult: null,
      } as never)
      const saved = (await this.approvals.save(next as never)) as unknown as BlueprintApproval
      created.push(saved)
      await this.workItems.project({
        organizationId,
        sourceType: 'approval',
        sourceId: saved.id,
        title: `审批 ${saved.entity}:${saved.recordId}`,
        priority: 'normal',
        dueAt: saved.dueAt,
        metadata: { ruleId: saved.ruleId, round: nextRound, stepIndex: saved.stepIndex },
      })
    }
    await this.events.save(
      this.events.create({
        organizationId,
        approvalId: anchor.id,
        recordId: anchor.recordId,
        type: 'resubmit',
        actorId: actor.userId,
        payload: { fromRound: latestRound, toRound: nextRound, comment: comment ?? null },
      }),
    )
    return created
  }

  isAllowed(approval: BlueprintApproval, actor: ReviewDecisionActor): boolean {
    // check 步骤不按角色授权；只有 warn 人工确认路径，权限由 review:act 控制。
    if (approval.kind !== 'check' && approval.role && !actor.roleKeys?.includes(approval.role)) return false
    if (approval.assignee && typeof approval.assignee === 'object') {
      const assignee = approval.assignee as { userId?: unknown }
      if (typeof assignee.userId === 'string' && assignee.userId !== actor.userId) return false
    }
    if (approval.selector) {
      const selector = normalizeSelector(approval.selector)
      if (!selector || !selectorMatchesActor(selector, actor)) return false
    }
    return true
  }
}
