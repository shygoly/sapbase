import { DomainError, BusinessRuleViolation } from '../errors'

export enum AIModuleStatus {
  DRAFT = 'draft',
  TESTING = 'testing',
  PENDING_REVIEW = 'pending_review',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
}

/**
 * Domain entity: AIModule (pure, no TypeORM).
 */
export class AIModule {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly name: string,
    private _description: string | null,
    private _naturalLanguagePrompt: string | null,
    private _patchContent: Record<string, any>,
    private _status: AIModuleStatus,
    private _version: string,
    public readonly aiModelId: string | null,
    public readonly createdById: string | null,
    private _reviewedById: string | null,
    private _reviewedAt: Date | null,
    private _reviewComments: string | null,
    private _publishedAt: Date | null,
    private _unpublishedAt: Date | null,
    private _testResults: Record<string, any> | null,
    private _metadata: Record<string, any> | null,
  ) {}

  get description(): string | null {
    return this._description
  }

  get naturalLanguagePrompt(): string | null {
    return this._naturalLanguagePrompt
  }

  get patchContent(): Record<string, any> {
    return this._patchContent
  }

  get status(): AIModuleStatus {
    return this._status
  }

  get version(): string {
    return this._version
  }

  get reviewedById(): string | null {
    return this._reviewedById
  }

  get reviewedAt(): Date | null {
    return this._reviewedAt
  }

  get reviewComments(): string | null {
    return this._reviewComments
  }

  get publishedAt(): Date | null {
    return this._publishedAt
  }

  get unpublishedAt(): Date | null {
    return this._unpublishedAt
  }

  get testResults(): Record<string, any> | null {
    return this._testResults
  }

  get metadata(): Record<string, any> | null {
    return this._metadata
  }

  /** Reconstruct from persistence (no validation). */
  static fromPersistence(
    id: string,
    organizationId: string,
    name: string,
    description: string | null,
    naturalLanguagePrompt: string | null,
    patchContent: Record<string, any>,
    status: AIModuleStatus,
    version: string,
    aiModelId: string | null,
    createdById: string | null,
    reviewedById: string | null,
    reviewedAt: Date | null,
    reviewComments: string | null,
    publishedAt: Date | null,
    unpublishedAt: Date | null,
    testResults: Record<string, any> | null,
    metadata: Record<string, any> | null,
  ): AIModule {
    return new AIModule(
      id,
      organizationId,
      name,
      description,
      naturalLanguagePrompt,
      patchContent,
      status,
      version,
      aiModelId,
      createdById,
      reviewedById,
      reviewedAt,
      reviewComments,
      publishedAt,
      unpublishedAt,
      testResults,
      metadata,
    )
  }

  static create(
    id: string,
    organizationId: string,
    name: string,
    createdById: string | null,
  ): AIModule {
    if (!name || name.trim().length === 0) {
      throw new DomainError('Module name cannot be empty')
    }

    return new AIModule(
      id,
      organizationId,
      name.trim(),
      null,
      null,
      {},
      AIModuleStatus.DRAFT,
      '1.0.0',
      null,
      createdById,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    )
  }

  submitForReview(): void {
    if (this._status !== AIModuleStatus.DRAFT && this._status !== AIModuleStatus.TESTING) {
      throw new BusinessRuleViolation('Only draft or testing modules can be submitted for review')
    }
    this._status = AIModuleStatus.PENDING_REVIEW
  }

  submitReview(decision: 'approved' | 'rejected', reviewerId: string, comments?: string, rejectionReason?: string): void {
    if (this._status !== AIModuleStatus.PENDING_REVIEW && this._status !== AIModuleStatus.REVIEWING) {
      throw new BusinessRuleViolation('Module must be pending review or reviewing to submit review')
    }

    this._reviewedById = reviewerId
    this._reviewedAt = new Date()
    this._reviewComments = comments || null

    if (decision === 'approved') {
      this._status = AIModuleStatus.APPROVED
    } else {
      this._status = AIModuleStatus.REJECTED
      if (rejectionReason) {
        this._reviewComments = rejectionReason
      }
    }
  }

  publish(): void {
    if (this._status !== AIModuleStatus.APPROVED) {
      throw new BusinessRuleViolation('Only approved modules can be published')
    }
    this._status = AIModuleStatus.PUBLISHED
    this._publishedAt = new Date()
    this._unpublishedAt = null
  }

  unpublish(): void {
    if (this._status !== AIModuleStatus.PUBLISHED) {
      throw new BusinessRuleViolation('Only published modules can be unpublished')
    }
    this._status = AIModuleStatus.UNPUBLISHED
    this._unpublishedAt = new Date()
  }

  updatePatch(patchContent: Record<string, any>, naturalLanguagePrompt?: string): void {
    this._patchContent = patchContent
    if (naturalLanguagePrompt !== undefined) {
      this._naturalLanguagePrompt = naturalLanguagePrompt
    }
  }

  updateDescription(description: string | null): void {
    this._description = description
  }

  updateVersion(version: string): void {
    if (!version || version.trim().length === 0) {
      throw new DomainError('Version cannot be empty')
    }
    this._version = version.trim()
  }

  updateTestResults(testResults: Record<string, any> | null): void {
    this._testResults = testResults
    if (this._status === AIModuleStatus.DRAFT) {
      this._status = AIModuleStatus.TESTING
    }
  }

  updateMetadata(metadata: Record<string, any> | null): void {
    this._metadata = metadata
  }

  canBePublished(): boolean {
    return this._status === AIModuleStatus.APPROVED
  }

  canBeReviewed(): boolean {
    return this._status === AIModuleStatus.PENDING_REVIEW || this._status === AIModuleStatus.REVIEWING
  }
}
