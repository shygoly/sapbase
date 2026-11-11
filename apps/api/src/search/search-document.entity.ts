import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

/**
 * 统一搜索文档：一个资源一条（organizationId + resourceKey + resourceId 唯一）。
 * 只存可检索/可展示字段；敏感字段在写入前就不进文档（字段脱敏）。
 */
@Entity('search_documents')
@Unique('UQ_search_document_org_resource', ['organizationId', 'resourceKey', 'resourceId'])
@Index('idx_search_document_org_resource', ['organizationId', 'resourceKey', 'indexedAt'])
export class SearchDocument extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 64 })
  resourceKey: string

  @Column({ type: 'varchar', length: 128 })
  resourceId: string

  @Column({ type: 'text' })
  title: string

  @Column({ type: 'text', default: '' })
  body: string

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags: string[]

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>

  @Column({ type: 'varchar', length: 64 })
  contentHash: string

  @Column({ type: 'timestamptz', default: () => 'now()' })
  indexedAt: Date
}
