import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type AiContentType = 'text' | 'image' | 'audio' | 'video' | 'asset' | 'module'
export type ContentLabelType = 'explicit' | 'implicit'
export type ContentLabelStatus = 'pending' | 'applied' | 'failed'
export type AiScoreStatus = 'ai_only' | 'teacher_confirmed' | 'appealed' | 'final'

@Entity('ai_content_provenance')
@Index('idx_ai_provenance_org_content', ['organizationId', 'contentId', 'version'])
export class AiContentProvenance extends TenantAwareEntity {
  @Column({ type: 'uuid' }) contentId: string
  @Column({ type: 'varchar', length: 32 }) contentType: AiContentType
  @Column({ type: 'varchar', length: 255 }) producer: string
  @Column({ type: 'varchar', length: 128, nullable: true }) agent: string | null
  @Column({ type: 'varchar', length: 128, nullable: true }) model: string | null
  @Column({ type: 'varchar', length: 64, nullable: true }) promptHash: string | null
  @Column({ type: 'varchar', length: 255, nullable: true }) templateRef: string | null
  @Column({ type: 'varchar', length: 128, nullable: true }) taskId: string | null
  @Column({ type: 'varchar', length: 64 }) contentHash: string
  @Column({ type: 'uuid', nullable: true }) parentContentId: string | null
  @Column({ type: 'int', default: 1 }) version: number
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null
}

@Entity('ai_content_labels')
@Unique('UQ_ai_label_content_type_version', ['contentId', 'labelType', 'version'])
@Index('idx_ai_label_org_content', ['organizationId', 'contentId'])
export class AiContentLabel extends TenantAwareEntity {
  @Column({ type: 'uuid' }) contentId: string
  @Column({ type: 'varchar', length: 16 }) labelType: ContentLabelType
  @Column({ type: 'int', default: 1 }) version: number
  @Column({ type: 'text' }) text: string
  @Column({ type: 'varchar', length: 16, default: 'pending' }) status: ContentLabelStatus
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null
  @Column({ type: 'timestamptz', nullable: true }) appliedAt: Date | null
  @Column({ type: 'timestamptz', nullable: true }) verifiedAt: Date | null
}

@Entity('ai_score_records')
@Index('idx_ai_score_org_content', ['organizationId', 'contentId'])
@Index('idx_ai_score_org_subject', ['organizationId', 'subjectType', 'subjectId'])
export class AiScoreRecord extends TenantAwareEntity {
  @Column({ type: 'uuid', nullable: true }) contentId: string | null
  @Column({ type: 'varchar', length: 32 }) subjectType: string
  @Column({ type: 'varchar', length: 128 }) subjectId: string
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) aiScore: string | null
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) humanScore: string | null
  @Column({ type: 'varchar', length: 24, default: 'ai_only' }) status: AiScoreStatus
  @Column({ type: 'varchar', length: 64, nullable: true }) ruleVersion: string | null
  @Column({ type: 'uuid', nullable: true }) confirmedBy: string | null
  @Column({ type: 'timestamptz', nullable: true }) confirmedAt: Date | null
  @Column({ type: 'text', nullable: true }) appealReason: string | null
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null
}
