import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import { ReviewDecision, AIModuleReview } from '../../domain/entities'
import type { IAIModuleRepository } from '../../domain/repositories'
import type { IAIModuleReviewRepository } from '../../domain/repositories'
import { AI_MODULE_REPOSITORY, AI_MODULE_REVIEW_REPOSITORY, EVENT_PUBLISHER } from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { ReviewSubmittedEvent } from '../../domain/events'
import { v4 as uuidv4 } from 'uuid'

export interface SubmitReviewCommand {
  moduleId: string
  reviewerId: string
  decision: 'approved' | 'rejected'
  comments?: string
  rejectionReason?: string
  organizationId: string
}

@Injectable()
export class SubmitReviewService {
  constructor(
    @Inject(AI_MODULE_REPOSITORY)
    private readonly moduleRepository: IAIModuleRepository,
    @Inject(AI_MODULE_REVIEW_REPOSITORY)
    private readonly reviewRepository: IAIModuleReviewRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: SubmitReviewCommand): Promise<void> {
    const module = await this.moduleRepository.findById(command.moduleId, command.organizationId)
    if (!module) {
      throw new BusinessRuleViolation('Module not found')
    }

    if (!module.canBeReviewed()) {
      throw new BusinessRuleViolation('Module must be pending review or reviewing to submit review')
    }

    const decision = command.decision === 'approved' ? ReviewDecision.APPROVED : ReviewDecision.REJECTED
    module.submitReview(command.decision, command.reviewerId, command.comments, command.rejectionReason)

    const reviewId = uuidv4()
    const review = AIModuleReview.create(
      command.moduleId,
      command.reviewerId,
      decision,
      command.comments,
      command.rejectionReason,
    )
    ;(review as any).id = reviewId

    await this.moduleRepository.save(module)
    await this.reviewRepository.save(review)

    await this.eventPublisher.publish(
      new ReviewSubmittedEvent(
        command.moduleId,
        command.organizationId,
        command.reviewerId,
        decision,
        new Date(),
      ),
    )
  }
}
