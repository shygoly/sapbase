import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

/**
 * 模板约束下的实体实例（通用记录表）。
 *
 * 没有列约束：字段形状由写入链按模板校验，不由数据库强制。
 * 直连库写入不受约束 —— 这是有意的代价，写进协议 §7.3。
 */
@Entity('blueprint_records')
@Index('idx_blueprint_records_blueprint_entity_org', [
  'blueprintId',
  'entity',
  'organizationId',
])
export class BlueprintRecord extends TenantAwareEntity {
  @Column()
  blueprintId: string

  @Column()
  blueprintVersion: string

  @Column()
  entity: string

  @Column({ type: 'jsonb' })
  data: Record<string, unknown>
}
