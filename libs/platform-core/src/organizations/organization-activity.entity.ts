import { Entity, Column, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { Organization } from './organization.entity'
import { User } from '../users/user.entity'

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_ORGANIZATION = 'CREATE_ORGANIZATION',
  REMOVE_MEMBER = 'REMOVE_MEMBER',
  INVITE_MEMBER = 'INVITE_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
  UPDATE_MEMBER_ROLE = 'UPDATE_MEMBER_ROLE',
  UPDATE_ORGANIZATION = 'UPDATE_ORGANIZATION',
}

@Entity('organization_activities')
export class OrganizationActivity extends BaseEntity {
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  organization: Organization

  @Column()
  organizationId: string

  @ManyToOne(() => User, { nullable: true })
  user: User

  @Column({ nullable: true })
  userId: string

  @Column({ type: 'varchar', length: 100 })
  action: ActivityType

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date
}
