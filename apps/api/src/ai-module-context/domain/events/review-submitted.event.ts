import { ReviewDecision } from '../entities'

/**
 * Domain event: a review was submitted for an AI module.
 */
export class ReviewSubmittedEvent {
  constructor(
    public readonly moduleId: string,
    public readonly organizationId: string,
    public readonly reviewerId: string,
    public readonly decision: ReviewDecision,
    public readonly reviewedAt: Date,
  ) {}
}
