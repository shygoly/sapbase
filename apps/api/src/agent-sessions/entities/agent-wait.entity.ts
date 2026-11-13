import { Column, Entity, Index } from 'typeorm'
import { AgentSessionBaseEntity } from './agent-session-base.entity'

export type AgentWaitKind = 'user' | 'external'
export type AgentWaitStatus = 'pending' | 'resolved' | 'cancelled'

@Entity('agent_waits')
@Index('IDX_agent_waits_run_status', ['runId', 'status'])
@Index('IDX_agent_waits_org_status', ['organizationId', 'status', 'createdAt'])
export class AgentWait extends AgentSessionBaseEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) runId: string
  @Column({ type: 'varchar', length: 32 }) kind: AgentWaitKind
  @Column({ type: 'varchar', length: 32, default: 'pending' }) status: AgentWaitStatus
  @Column({ type: 'text', nullable: true }) prompt: string | null
  @Column({ type: 'jsonb', nullable: true }) payload: Record<string, unknown> | null
  @Column({ type: 'jsonb', nullable: true }) resolution: Record<string, unknown> | null
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt: Date | null
}
