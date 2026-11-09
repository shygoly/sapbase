import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type RoleBindingSource = 'manual' | 'legacy' | 'sso' | 'sync'

/**
 * 组织内多角色绑定。
 *
 * 有效权限 = 本组织内 active 且未过期的角色并集 ∪ 用户直授权限。
 * `users.roleId` 保留为兼容回退，不删除；新授权优先走本表。
 */
@Entity('organization_member_roles')
@Index('idx_omr_org_user_status', ['organizationId', 'userId', 'status'])
@Index('idx_omr_org_role_status', ['organizationId', 'roleId', 'status'])
@Index('UQ_omr_org_user_role', ['organizationId', 'userId', 'roleName'], { unique: true })
export class OrganizationMemberRole extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'uuid', nullable: true })
  roleId: string | null

  @Column({ type: 'varchar', length: 128 })
  roleName: string

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source: RoleBindingSource

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: 'active' | 'inactive'

  @Column({ type: 'timestamptz', nullable: true })
  validFrom: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  validTo: Date | null

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null
}
