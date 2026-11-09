import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'
import type { JobStatus } from './job-state'

@Entity('jobs')
@Index('idx_jobs_org_status_created', ['organizationId', 'status', 'createdAt'])
@Index('idx_jobs_status_run_priority', ['status', 'runAt', 'priority'])
@Index('idx_jobs_idempotency', ['organizationId', 'type', 'idempotencyKey'], { unique: true })
export class Job extends TenantAwareEntity {
  @Column({ type: 'uuid', nullable: true })
  appInstallationId: string | null

  @Column({ type: 'varchar', length: 128 })
  type: string

  @Column({ type: 'int', default: 1 })
  typeVersion: number

  @Column({ type: 'varchar', length: 32, default: 'queued' })
  status: JobStatus

  @Column({ type: 'int', default: 0 })
  priority: number

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null

  @Column({ type: 'jsonb', nullable: true })
  error: Record<string, unknown> | null

  @Column({ type: 'int', default: 0 })
  progress: number

  @Column({ type: 'varchar', length: 255, nullable: true })
  idempotencyKey: string | null

  @Column({ type: 'int', default: 0 })
  attempts: number

  @Column({ type: 'int', default: 3 })
  maxAttempts: number

  @Column({ type: 'timestamptz', default: () => 'now()' })
  runAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  leaseUntil: Date | null

  @Column({ type: 'varchar', length: 128, nullable: true })
  workerId: string | null

  @Column({ type: 'boolean', default: false })
  cancelRequested: boolean

  @Column({ type: 'varchar', length: 1024, nullable: true })
  callbackUrl: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  callbackSecretRef: string | null

  @Column({ type: 'varchar', length: 32, nullable: true })
  callbackStatus: string | null

  @Column({ type: 'int', default: 0 })
  callbackAttempts: number

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null
}
