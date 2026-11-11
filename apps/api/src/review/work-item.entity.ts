import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('work_items')
@Index('idx_work_item_org_status_priority', ['organizationId', 'status', 'priority', 'dueAt'])
@Index('UQ_work_item_org_source', ['organizationId', 'sourceType', 'sourceId'], { unique: true })
export class WorkItem extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 32 }) sourceType: string
  @Column({ type: 'uuid' }) sourceId: string
  @Column({ type: 'varchar', length: 255 }) title: string
  @Column({ type: 'varchar', length: 32, default: 'open' }) status: 'open' | 'done' | 'dismissed'
  @Column({ type: 'uuid', nullable: true }) assigneeId: string | null
  @Column({ type: 'varchar', length: 16, default: 'normal' }) priority: 'low' | 'normal' | 'high' | 'urgent'
  @Column({ type: 'timestamptz', nullable: true }) dueAt: Date | null
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null
  @Column({ type: 'timestamptz', nullable: true }) readAt: Date | null
}
