import { Column, Entity, Index, Unique } from 'typeorm'
import { AgentSessionBaseEntity } from './agent-session-base.entity'

export type AgentDefinitionStatus = 'draft' | 'published' | 'retired'

@Entity('agent_definitions')
@Unique('UQ_agent_definitions_org_key_version', ['organizationId', 'key', 'version'])
@Index('IDX_agent_definitions_org_key', ['organizationId', 'key', 'version'])
export class AgentDefinition extends AgentSessionBaseEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'int', default: 1 }) version: number
  @Column({ type: 'varchar', length: 255 }) name: string
  @Column({ type: 'varchar', length: 64 }) role: string
  @Column({ type: 'text', nullable: true }) instructions: string | null
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) policy: Record<string, unknown>
  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" }) toolScopes: string[]
  @Column({ type: 'varchar', length: 32, default: 'draft' }) status: AgentDefinitionStatus
  @Column({ type: 'uuid', nullable: true }) createdById: string | null
}
