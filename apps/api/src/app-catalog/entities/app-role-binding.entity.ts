import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../../common/entities/tenant-aware.entity'

export type AppRoleStatus = 'active' | 'inactive'
export type AppRoleSource = 'manual' | 'blueprint' | 'plan'

@Entity('app_role_bindings')
@Unique('uq_app_role_bindings_org_app_name', ['organizationId', 'appKey', 'name'])
@Index('idx_app_role_bindings_org_app_status', ['organizationId', 'appKey', 'status'])
export class AppRoleBinding extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'varchar', length: 128 })
  name: string

  /** 应用内功能权限点；与组织级角色并集后进入 JWT/工具判定。 */
  @Column({ type: 'simple-array', default: '' })
  permissions: string[]

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source: AppRoleSource

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: AppRoleStatus

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null
}
