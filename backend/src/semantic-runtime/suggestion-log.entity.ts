import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

/**
 * 夜间建议日志。每晚追加，不去重。
 * 旧 `workflow_auto_suggestion_logs` 仍只读归档（外键指向 workflow_instances）。
 */
@Entity('blueprint_suggestion_logs')
@Index('IDX_643163585d4666a25396508f3a', ['blueprintId', 'entity', 'recordId'])
export class BlueprintSuggestionLog extends TenantAwareEntity {
  @Column()
  blueprintId: string

  @Column()
  entity: string

  @Column({ type: 'uuid' })
  recordId: string

  @Column({ type: 'varchar', length: 255 })
  suggestedToState: string

  @Column({ type: 'text', nullable: true })
  reason: string | null
}
