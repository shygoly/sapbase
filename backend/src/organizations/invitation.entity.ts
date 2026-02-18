import { Entity, Column, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { Organization } from './organization.entity'
import { User } from '../users/user.entity'
import { OrganizationRole } from './organization-member.entity'

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('invitations')
export class Invitation extends BaseEntity {
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  organization: Organization

  @Column()
  organizationId: string

  @Column({ type: 'varchar', length: 255 })
  email: string

  @Column({ type: 'varchar', length: 50, default: OrganizationRole.MEMBER })
  role: OrganizationRole

  @ManyToOne(() => User)
  invitedBy: User

  @Column()
  invitedById: string

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  invitedAt: Date

  @Column({ type: 'varchar', length: 50, default: InvitationStatus.PENDING })
  status: InvitationStatus

  @Column({ type: 'varchar', length: 255, unique: true })
  token: string

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date
}
