import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

/**
 * AI 模块版本快照：每次生成/修改/评审/发布/回滚写一行。
 * 回滚恢复 patchContent/metadata/version，并生成新的快照，不删除历史。
 */
@Entity('ai_module_versions')
@Index('idx_ai_module_version_org_module_created', [
  'organizationId',
  'moduleId',
  'createdAt',
])
export class AIModuleVersion extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  moduleId: string

  @Column({ type: 'varchar', length: 50 })
  version: string

  @Column({ type: 'jsonb' })
  patchContent: Record<string, any>

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null

  @Column({ type: 'jsonb', nullable: true })
  definition: Record<string, any> | null

  @Column({ type: 'varchar', length: 50 })
  status: string

  @Column({ type: 'varchar', length: 255, default: 'system' })
  actor: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null
}
