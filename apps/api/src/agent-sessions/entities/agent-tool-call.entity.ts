import { Column, Entity } from 'typeorm'
import { AgentSessionBaseEntity } from './agent-session-base.entity'

@Entity('agent_tool_calls')
export class AgentToolCall extends AgentSessionBaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string

  @Column({ type: 'uuid' })
  turnId: string

  @Column({ type: 'varchar', length: 64 })
  tool: string

  @Column({ type: 'varchar', length: 64, nullable: true })
  argsDigest: string | null

  @Column({ type: 'boolean', default: false })
  permissionOk: boolean

  @Column({ type: 'uuid', nullable: true })
  confirmationId: string | null

  @Column({ type: 'varchar', length: 32 })
  status: 'success' | 'failure'

  @Column({ type: 'varchar', length: 32, nullable: true })
  errorCode: string | null

  @Column({ type: 'integer', default: 0 })
  latencyMs: number
}
