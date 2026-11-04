import { DomainError } from '../errors'

export enum ReviewDecision {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING = 'pending',
}

/**
 * Domain entity: AIModuleReview (pure, no TypeORM).
 */
export class AIModuleReview {
  private constructor(
    public readonly id: string,
    public readonly moduleId: string,
    public readonly reviewerId: string,
    private _decision: ReviewDecision,
    private _comments: string | null,
    private _rejectionReason: string | null,
    private _reviewedAt: Date | null,
    private _reviewData: Record<string, any> | null,
  ) {}

  get decision(): ReviewDecision {
    return this._decision
  }

  get comments(): string | null {
    return this._comments
  }

  get rejectionReason(): string | null {
    return this._rejectionReason
  }

  get reviewedAt(): Date | null {
    return this._reviewedAt
  }

  get reviewData(): Record<string, any> | null {
    return this._reviewData
  }

  /** Reconstruct from persistence (no validation). */
  static fromPersistence(
    id: string,
    moduleId: string,
    reviewerId: string,
    decision: ReviewDecision,
    comments: string | null,
    rejectionReason: string | null,
    reviewedAt: Date | null,
    reviewData: Record<string, any> | null,
  ): AIModuleReview {
    return new AIModuleReview(
      id,
      moduleId,
      reviewerId,
      decision,
      comments,
      rejectionReason,
      reviewedAt,
      reviewData,
    )
  }

  static create(
    moduleId: string,
    reviewerId: string,
    decision: ReviewDecision,
    comments?: string,
    rejectionReason?: string,
  ): AIModuleReview {
    return new AIModuleReview(
      '', // ID assigned by repository
      moduleId,
      reviewerId,
      decision,
      comments || null,
      rejectionReason || null,
      decision !== ReviewDecision.PENDING ? new Date() : null,
      null,
    )
  }

  updateDecision(decision: ReviewDecision, comments?: string, rejectionReason?: string): void {
    this._decision = decision
    if (comments !== undefined) {
      this._comments = comments
    }
    if (rejectionReason !== undefined) {
      this._rejectionReason = rejectionReason
    }
    if (decision !== ReviewDecision.PENDING) {
      this._reviewedAt = new Date()
    }
  }
}
