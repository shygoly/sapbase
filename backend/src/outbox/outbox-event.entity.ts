import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type OutboxEventStatus = 'pending' | 'delivered' | 'failed'

@Entity('outbox_events')
@Unique('UQ_2664623806d6e3483057865b8b6', ['idempotencyKey'])
@Index('IDX_d2869b821d7b201618c9858ab6', ['status', 'nextAttemptAt'])
@Index('IDX_d2d9822da80020878a360eaf40', ['organizationId', 'occurredAt'])
@Index('IDX_34d5a8c6d3ddf4e6375e11131c', ['aggregateType', 'aggregateId'])
export class OutboxEvent extends TenantAwareEntity {
  @Column()
  topic: string

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>

  @Column({ type: 'timestamp' })
  occurredAt: Date

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null

  @Column({ type: 'int', default: 0 })
  attempts: number

  @Column({ type: 'text', nullable: true })
  lastError: string | null

  @Column()
  idempotencyKey: string

  @Column()
  status: OutboxEventStatus

  @Column({ type: 'timestamp', nullable: true })
  nextAttemptAt: Date | null

  @Column({ type: 'varchar', nullable: true })
  aggregateType: string | null

  @Column({ type: 'varchar', nullable: true })
  aggregateId: string | null
}
