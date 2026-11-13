import { Column, Entity, Index, Unique } from 'typeorm'
import { AgentSessionBaseEntity } from './agent-session-base.entity'

export type AgentInstanceProfile = 'piagent-runtime' | 'piagent-builder'
export type AgentInstanceStatus = 'active' | 'suspended'

@Entity('agent_instances')
@Unique('UQ_agent_instances_org_app_user_definition', [
  'organizationId',
  'appKey',
  'userId',
  'definitionId',
])
@Index('IDX_agent_instances_org_user', ['organizationId', 'userId', 'appKey'])
export class AgentInstance extends AgentSessionBaseEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 64 }) appKey: string
  @Column({ type: 'uuid', nullable: true }) appInstallationId: string | null
  @Column({ type: 'uuid' }) userId: string
  @Column({ type: 'uuid' }) definitionId: string
  @Column({ type: 'varchar', length: 32, default: 'piagent-runtime' })
  profile: AgentInstanceProfile
  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: AgentInstanceStatus
}
