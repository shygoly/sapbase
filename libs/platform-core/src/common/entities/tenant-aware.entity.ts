import { Column, ManyToOne } from 'typeorm'
import { BaseEntity } from './base.entity'
// **必须**是 type-only import，且关系目标用字符串名：否则会形成
// tenant-aware → organization → organization-member → user → role → tenant-aware
// 的加载期循环，`Role extends TenantAwareEntity` 拿到 undefined，
// 44 个套件一起报 "Class extends value undefined"。字符串目标对 TypeORM 等价。
import type { Organization } from '../../organizations/organization.entity'

/**
 * Base class for entities that belong to an organization (tenant-scoped)
 * Extend this instead of BaseEntity for tenant-scoped entities
 */
export abstract class TenantAwareEntity extends BaseEntity {
  @ManyToOne('Organization', { nullable: false })
  organization: Organization

  @Column()
  organizationId: string
}
