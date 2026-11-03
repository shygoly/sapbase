import { Column, Entity } from 'typeorm'
import { KnowledgeBaseEntity } from './knowledge-base.entity'

@Entity('agent_skill_versions')
export class AgentSkillVersion extends KnowledgeBaseEntity {
  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null

  @Column({ type: 'varchar', length: 128 })
  skillKey: string

  @Column({ type: 'integer' })
  version: number

  @Column({ type: 'varchar', length: 80 })
  digest: string

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: 'draft' | 'canary' | 'active' | 'retired'

  @Column({ type: 'uuid', nullable: true })
  releaseId: string | null
}
