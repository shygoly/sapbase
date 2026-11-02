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

  @Column({ type: 'integer', default: 0 })
  tokensIn: number

  @Column({ type: 'integer', default: 0 })
  tokensOut: number

  @Column({ type: 'integer', default: 0 })
  latencyMs: number

  @Column({ type: 'varchar', length: 32, default: 'running' })
  status: 'running' | 'completed' | 'cancelled' | 'failed'
}
