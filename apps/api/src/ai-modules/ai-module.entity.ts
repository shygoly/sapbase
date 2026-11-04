import { Entity, Column, ManyToOne, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'
import { AIModel } from '../ai-models/ai-model.entity'
import { User } from '../users/user.entity'

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

@Entity('ai_modules')
@Index('idx_ai_module_organization', ['organizationId'])
export class AIModule extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'text', nullable: true })
  naturalLanguagePrompt: string

  @Column({ type: 'jsonb' })
  patchContent: Record<string, any>

  @Column({ type: 'varchar', length: 50, default: AIModuleStatus.DRAFT })
  status: AIModuleStatus

  @Column({ type: 'varchar', length: 50, default: '1.0.0' })
  version: string

  @ManyToOne(() => AIModel, { nullable: true })
  aiModel: AIModel

  @Column({ nullable: true })
  aiModelId: string

  @ManyToOne(() => User, { nullable: true })
  createdBy: User

  @Column({ nullable: true })
  createdById: string

  @ManyToOne(() => User, { nullable: true })
  reviewedBy: User

  @Column({ nullable: true })
  reviewedById: string

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date

  @Column({ type: 'text', nullable: true })
  reviewComments?: string

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date

  @Column({ type: 'timestamp', nullable: true })
  unpublishedAt: Date

  @Column({ type: 'jsonb', nullable: true })
  testResults: Record<string, any>

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>
}
