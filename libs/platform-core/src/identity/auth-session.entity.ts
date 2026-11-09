import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('auth_sessions')
@Index('UQ_auth_sessions_sid', ['sid'], { unique: true })
@Index('idx_auth_sessions_org_user_status', ['organizationId', 'userId', 'status'])
@Index('idx_auth_sessions_expires', ['status', 'expiresAt'])
export class AuthSession extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'uuid' })
  sid: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  refreshTokenHash: string | null

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: 'active' | 'revoked' | 'expired'

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null

  @Column({ type: 'timestamptz' })
  expiresAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  revokedReason: string | null
}
