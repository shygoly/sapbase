import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'

@Entity('job_attempts')
@Index('idx_job_attempts_job_attempt', ['jobId', 'attempt'], { unique: true })
export class JobAttempt extends BaseEntity {
  @Column({ type: 'uuid' })
  jobId: string

  @Column({ type: 'int' })
  attempt: number

  @Column({ type: 'varchar', length: 32 })
  status: string

  @Column({ type: 'jsonb', nullable: true })
  error: Record<string, unknown> | null

  @Column({ type: 'timestamptz' })
  startedAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null

  @Column({ type: 'int', nullable: true })
  durationMs: number | null
}
