import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import { AIModuleReview as AIModuleReviewOrm } from '../../../ai-modules/ai-module-review.entity'
import { AIModuleReview, ReviewDecision } from '../../domain/entities'
import type { IAIModuleReviewRepository } from '../../domain/repositories'

@Injectable()
export class AIModuleReviewRepository implements IAIModuleReviewRepository {
  constructor(
    @InjectRepository(AIModuleReviewOrm)
    private readonly repo: Repository<AIModuleReviewOrm>,
  ) {}

  async save(review: AIModuleReview): Promise<void> {
    const id = review.id && review.id !== '' ? review.id : uuidv4()
    await this.repo.save({
      id,
      moduleId: review.moduleId,
      reviewerId: review.reviewerId,
      decision: review.decision as AIModuleReviewOrm['decision'],
      comments: review.comments ?? null,
      rejectionReason: review.rejectionReason ?? null,
      reviewedAt: review.reviewedAt ?? null,
      reviewData: review.reviewData ?? null,
    } as Partial<AIModuleReviewOrm>)
  }

  async findById(id: string): Promise<AIModuleReview | null> {
    const row = await this.repo.findOne({ where: { id } })
    if (!row) return null
    return this.toDomain(row)
  }

  async findByModule(moduleId: string): Promise<AIModuleReview[]> {
    const rows = await this.repo.find({
      where: { moduleId },
      order: { reviewedAt: 'DESC' },
    })
    return rows.map((row) => this.toDomain(row))
  }

  async findLatestByModule(moduleId: string): Promise<AIModuleReview | null> {
    const row = await this.repo.findOne({
      where: { moduleId },
      order: { reviewedAt: 'DESC' },
    })
    if (!row) return null
    return this.toDomain(row)
  }

  private toDomain(row: AIModuleReviewOrm): AIModuleReview {
    return AIModuleReview.fromPersistence(
      row.id,
      row.moduleId,
      row.reviewerId,
      (row.decision as ReviewDecision) ?? ReviewDecision.PENDING,
      row.comments ?? null,
      row.rejectionReason ?? null,
      row.reviewedAt ?? null,
      row.reviewData ?? null,
    )
  }
}
