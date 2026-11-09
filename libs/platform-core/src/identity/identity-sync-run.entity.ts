import { Column, Entity } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('identity_sync_runs')
export class IdentitySyncRun extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  providerId: string

  @Column({ type: 'varchar', length: 32, default: 'running' })
  status: 'running' | 'succeeded' | 'failed' | 'partial'

  @Column({ type: 'jsonb', nullable: true })
  stats: Record<string, unknown> | null

  @Column({ type: 'jsonb', nullable: true })
  error: Record<string, unknown> | null

  @Column({ type: 'timestamptz', default: () => 'now()' })
  startedAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null
}
