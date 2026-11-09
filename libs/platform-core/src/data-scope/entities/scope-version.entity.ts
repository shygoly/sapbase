import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../../common/entities/tenant-aware.entity'

/**
 * 每个组织一条单调递增的范围版本；任何维度/节点/成员/策略/绑定变更都应 bump。
 * 缓存 key 用它，避免跨版本读到旧解析结果。
 */
@Entity('scope_versions')
@Index('idx_scope_version_org', ['organizationId'], { unique: true })
export class ScopeVersion extends TenantAwareEntity {
  @Column({ type: 'int', default: 1 })
  version: number
}
