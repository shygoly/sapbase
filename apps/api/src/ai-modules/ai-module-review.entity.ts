import { Entity, Column, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { AIModule } from './ai-module.entity'
import { User } from '../users/user.entity'

export enum ReviewDecision {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING = 'pending',
}

@Entity('ai_module_reviews')
export class AIModuleReview extends BaseEntity {
  @ManyToOne(() => AIModule, { onDelete: 'CASCADE' })
  module: AIModule

  @Column()
  moduleId: string

  @ManyToOne(() => User)
  reviewer: User

  @Column()
  reviewerId: string

  @Column({ type: 'varchar', length: 50, default: ReviewDecision.PENDING })
  decision: ReviewDecision

  @Column({ type: 'text', nullable: true })
  comments: string

  @Column({ type: 'text', nullable: true })
  rejectionReason: string

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date

  @Column({ type: 'jsonb', nullable: true })
  reviewData: Record<string, any>
}
