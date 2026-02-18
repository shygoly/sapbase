import { Entity, Column, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { Organization } from './organization.entity'
import { User } from '../users/user.entity'

export enum OrganizationRole {
  OWNER = 'owner',
  MEMBER = 'member',
}

@Entity('organization_members')
export class OrganizationMember extends BaseEntity {
  @ManyToOne(() => Organization, (org) => org.members, { onDelete: 'CASCADE' })
  organization: Organization

  @Column()
  organizationId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User

  @Column()
  userId: string

  @Column({ type: 'varchar', length: 50, default: OrganizationRole.MEMBER })
  role: OrganizationRole

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  joinedAt: Date

  @ManyToOne(() => User, { nullable: true })
  invitedBy: User

  @Column({ nullable: true })
  invitedById: string
}
