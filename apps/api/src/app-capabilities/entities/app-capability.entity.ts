import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../../common/entities/tenant-aware.entity'

@Entity('app_capabilities')
@Unique('uq_app_capabilities_org_publisher_name', [
  'organizationId',
  'publisherAppKey',
  'name',
])
@Index('idx_app_capabilities_org_publisher_status', [
  'organizationId',
  'publisherAppKey',
  'status',
])
export class AppCapability extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 64 })
  publisherAppKey: string

  @Column({ type: 'varchar', length: 128 })
  name: string

  @Column({ type: 'varchar', length: 64 })
  entity: string

  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" })
  fields: string[]

  /** 消费方必须具备的功能权限点。 */
  @Column({ type: 'varchar', length: 128 })
  permission: string

  /** 行级 owner 字段；缺省不做 owner 过滤。 */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ownerField: string | null

  /** 具备该权限可跨 owner 读取；缺省只读自己的行。 */
  @Column({ type: 'varchar', length: 128, nullable: true })
  readAllPermission: string | null

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: 'active' | 'inactive'

  @Column({ type: 'int', default: 1 })
  version: number

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null
}
