import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { ReviewComment } from './review-comment.entity'
import { ReviewEvent } from './review-event.entity'
import { WorkItemsService } from './work-items.service'
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
    if (!this.isAllowed(approval, actor)) {
      throw new ForbiddenException('不是当前步骤的合法审批人')
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
        payload: { comment: comment ?? null, round: approval.round },
      }),
    )
    await this.workItems.close(organizationId, 'approval', approval.id)
    return saved
  }

  isAllowed(approval: BlueprintApproval, actor: ReviewDecisionActor): boolean {
    if (approval.role && !actor.roleKeys?.includes(approval.role)) return false
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
