import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('auth_login_events')
@Index('idx_auth_login_event_org_created', ['organizationId', 'createdAt'])
export class AuthLoginEvent extends TenantAwareEntity {
  @Column({ type: 'uuid', nullable: true })
  userId: string | null

  @Column({ type: 'varchar', length: 255 })
  email: string

  @Column({ type: 'varchar', length: 64, default: 'password' })
  provider: string

  @Column({ type: 'varchar', length: 32 })
  status: 'success' | 'failure'

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null
}
