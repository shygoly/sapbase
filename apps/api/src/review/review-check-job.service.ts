import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { JobContext } from '@sap/platform-core/jobs/job-types'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { ReviewEvent } from './review-event.entity'
import { ReviewCheckService, type ReviewCheckResult } from './review-check'
import {
  createReviewCheckJobDefinition,
  type ReviewCheckJobPayload,
  type ReviewCheckWriteback,
} from './review-check.job'

/**
 * 注册 `review.check`，并把机器检测结果回写审批步骤。
 *
 * - pass：check 步骤 approved
 * - fail：check 步骤 rejected
 * - warn：保持 pending，证据写入步骤，必须人工确认
 * - 每轮写 review_events，source 表仍以 blueprint_approvals 为准
 */
@Injectable()
export class ReviewCheckJobService implements OnModuleInit, ReviewCheckWriteback {
  private readonly logger = new Logger(ReviewCheckJobService.name)

  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly checks: ReviewCheckService,
    @InjectRepository(BlueprintApproval)
    private readonly approvals: Repository<BlueprintApproval>,
    @InjectRepository(ReviewEvent)
    private readonly events: Repository<ReviewEvent>,
  ) {}

  onModuleInit(): void {
    if (this.registry.has('review.check')) return
    this.registry.register(createReviewCheckJobDefinition(this.checks, this))
  }

  async record(
    ctx: JobContext,
    payload: ReviewCheckJobPayload,
    result: ReviewCheckResult,
  ): Promise<void> {
    if (!payload.approvalId) return

    const approval = await this.approvals.findOne({
      where: { id: payload.approvalId, organizationId: ctx.organizationId },
    })
    if (!approval) {
      this.logger.warn(`review.check ${ctx.jobId} 找不到审批步骤 ${payload.approvalId}`)
      return
    }
    if (
      (payload.round !== undefined && approval.round !== payload.round) ||
      (payload.stepIndex !== undefined && approval.stepIndex !== payload.stepIndex)
    ) {
      this.logger.warn(
        `review.check ${ctx.jobId} 审批步骤轮次/序号不匹配：${payload.approvalId}`,
      )
      return
    }

    const evidence = {
      provider: payload.provider,
      status: result.status,
      evidence: result.evidence,
      input: payload.input,
      jobId: ctx.jobId,
      checkedAt: new Date().toISOString(),
    }
    approval.checkResult = evidence

    // 机器检测只允许改变 check 步骤；human 步骤不能被机器代批。
    if (approval.kind === 'check') {
      if (result.status === 'pass') {
        approval.status = 'approved'
        approval.actor = 'system:review.check'
        approval.decidedAt = new Date()
      } else if (result.status === 'fail') {
        approval.status = 'rejected'
        approval.actor = 'system:review.check'
        approval.decidedAt = new Date()
      } else {
        approval.status = 'pending'
      }
    }
    await this.approvals.save(approval)

    await this.events.save(
      this.events.create({
        organizationId: ctx.organizationId,
        approvalId: approval.id,
        recordId: approval.recordId,
        type: 'check',
        actorId: null,
        payload: evidence,
      }),
    )
  }
}
