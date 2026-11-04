import { Column, Entity } from 'typeorm'
import { AgentSessionBaseEntity } from './agent-session-base.entity'

@Entity('agent_conversations')
export class AgentConversation extends AgentSessionBaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string

  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'uuid', nullable: true })
  appInstallationId: string | null

  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'uuid', nullable: true })
  releaseId: string | null

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastTurnAt: Date
}
