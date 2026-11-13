import { Column, Entity, Index } from 'typeorm'
import { AgentSessionBaseEntity } from './agent-session-base.entity'

export type AgentRunStatus =
  | 'queued'
  | 'running'
  | 'waiting_user'
  | 'waiting_external'
  | 'completed'
  | 'failed'
  | 'cancelled'

@Entity('agent_runs')
@Index('IDX_agent_runs_org_status', ['organizationId', 'status', 'createdAt'])
@Index('IDX_agent_runs_conversation', ['conversationId', 'createdAt'])
export class AgentRun extends AgentSessionBaseEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid', nullable: true }) conversationId: string | null
  @Column({ type: 'uuid', nullable: true }) agentInstanceId: string | null
  @Column({ type: 'uuid', nullable: true }) definitionId: string | null
  @Column({ type: 'uuid', nullable: true }) releaseId: string | null
  @Column({ type: 'varchar', length: 32, default: 'queued' }) status: AgentRunStatus
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) input: Record<string, unknown>
  @Column({ type: 'jsonb', nullable: true }) output: Record<string, unknown> | null
  @Column({ type: 'jsonb', nullable: true }) error: Record<string, unknown> | null
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) budget: Record<string, unknown>
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) usage: Record<string, unknown>
  @Column({ type: 'timestamptz', nullable: true }) startedAt: Date | null
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date | null
  @Column({ type: 'uuid', nullable: true }) createdById: string | null
}
