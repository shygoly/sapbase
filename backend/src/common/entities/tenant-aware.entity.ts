import { Column, ManyToOne } from 'typeorm'
import { BaseEntity } from './base.entity'
import { Organization } from '../../organizations/organization.entity'

/**
 * Base class for entities that belong to an organization (tenant-scoped)
 * Extend this instead of BaseEntity for tenant-scoped entities
 */
export abstract class TenantAwareEntity extends BaseEntity {
  @ManyToOne(() => Organization, { nullable: false })
  organization: Organization

  @Column()
  organizationId: string
}
