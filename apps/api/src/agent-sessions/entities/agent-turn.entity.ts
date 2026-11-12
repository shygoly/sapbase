import { Column, Entity } from 'typeorm'
import { AgentSessionBaseEntity } from './agent-session-base.entity'

@Entity('agent_turns')
export class AgentTurn extends AgentSessionBaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string

  @Column({ type: 'uuid' })
  conversationId: string

  @Column({ type: 'uuid', nullable: true })
  releaseId: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  modelId: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  promptHash: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  contextHash: string | null

  @Column({ type: 'varchar', length: 128, nullable: true })
  knowledgeVersion: string | null

  @Column({ type: 'integer', default: 0 })
  tokensIn: number

  @Column({ type: 'integer', default: 0 })
  tokensOut: number

  @Column({ type: 'integer', default: 0 })
  latencyMs: number

  @Column({ type: 'varchar', length: 32, default: 'running' })
  status: 'running' | 'completed' | 'cancelled' | 'failed'

  /** 本轮是否接触过不可信外部内容；写入知识前必须校验来源。 */
  @Column({ type: 'boolean', default: false })
  tainted: boolean

  @Column({ type: 'varchar', length: 128, nullable: true })
  taintSource: string | null

  /** 幂等键：同组织内唯一；重试返回已有 turn，不重复执行。 */
  @Column({ type: 'varchar', length: 128, nullable: true })
  idempotencyKey: string | null
}
