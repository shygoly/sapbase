import { Column, Entity } from 'typeorm'
import { KnowledgeBaseEntity } from './knowledge-base.entity'

@Entity('agent_knowledge_entries')
export class AgentKnowledgeEntry extends KnowledgeBaseEntity {
  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null

  @Column({ type: 'varchar', length: 32 })
  scope: 'global' | 'organization' | 'department' | 'user'

  @Column({ type: 'uuid', nullable: true })
  scopeId: string | null

  @Column({ type: 'varchar', length: 128 })
  knowledgeKey: string

  @Column({ type: 'integer' })
  version: number

  @Column({ type: 'text' })
  title: string

  @Column({ type: 'text' })
  body: string

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: 'draft' | 'published' | 'superseded'

  @Column({ type: 'uuid', nullable: true })
  releaseId: string | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  sensitiveReview: Record<string, unknown>
}
