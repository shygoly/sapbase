import { Column, Entity, Index } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'

@Entity('ai_model_calls')
@Index('idx_ai_model_calls_org_created', ['organizationId', 'createdAt'])
@Index('idx_ai_model_calls_request', ['requestedModelId', 'createdAt'])
export class AIModelCall extends BaseEntity {
  /** 可空：全局模型连接测试/平台任务没有组织上下文。 */
  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestedModelId: string | null

  @Column({ type: 'varchar', length: 64 })
  resolvedModelId: string

  @Column({ type: 'varchar', length: 50 })
  provider: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null

  @Column({ type: 'varchar', length: 32 })
  credentialSource: 'secret-ref' | 'legacy-inline' | 'missing'

  @Column({ type: 'varchar', length: 32, default: 'success' })
  status: 'success' | 'failure'

  @Column({ type: 'int', default: 0 })
  latencyMs: number

  @Column({ type: 'text', nullable: true })
  error: string | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null
}
