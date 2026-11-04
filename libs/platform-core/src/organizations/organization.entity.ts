import { Entity, Column, OneToMany } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { OrganizationMember } from './organization-member.entity'

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIALING = 'trialing',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
}

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  stripeCustomerId: string

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  stripeSubscriptionId: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeProductId: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  planName: string

  @Column({ type: 'varchar', length: 50, default: SubscriptionStatus.INCOMPLETE })
  subscriptionStatus: SubscriptionStatus

  @OneToMany(() => OrganizationMember, (member) => member.organization)
  members: OrganizationMember[]
}
