import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('agent_feedback_topics')
export class AgentFeedbackTopic {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date

  @Column({ type: 'uuid' })
  organizationId: string

  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'varchar', length: 128 })
  topicKey: string

  @Column({ type: 'text' })
  title: string

  @Column({ type: 'varchar', length: 32 })
  severity: 'low' | 'medium' | 'high'

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  evidence: string[]

  @Column({ type: 'varchar', length: 32, default: 'open' })
  status: 'open' | 'proposed' | 'resolved' | 'dismissed'

  @Column({ type: 'uuid', nullable: true })
  linkedProposalId: string | null
}
