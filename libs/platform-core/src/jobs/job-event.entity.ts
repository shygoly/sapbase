import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'

@Entity('job_events')
@Index('idx_job_events_job_seq', ['jobId', 'seq'], { unique: true })
export class JobEvent extends BaseEntity {
  @Column({ type: 'uuid' })
  jobId: string

  @Column({ type: 'int' })
  seq: number

  @Column({ type: 'varchar', length: 32 })
  type: string

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>
}
