import { Column, Entity, Index, Unique } from 'typeorm'
import { AgentSessionBaseEntity } from './agent-session-base.entity'

@Entity('agent_steps')
@Unique('UQ_agent_steps_run_seq', ['runId', 'seq'])
@Index('IDX_agent_steps_run_seq', ['runId', 'seq'])
export class AgentStep extends AgentSessionBaseEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) runId: string
  @Column({ type: 'int' }) seq: number
  @Column({ type: 'varchar', length: 32 }) type: string
  @Column({ type: 'varchar', length: 32, default: 'recorded' }) status: string
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) payload: Record<string, unknown>
}
