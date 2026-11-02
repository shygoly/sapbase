import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('agent_feedback')
export class AgentFeedback {
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

  @Column({ type: 'uuid', nullable: true })
  releaseId: string | null

  @Column({ type: 'jsonb', nullable: true })
  cohort: Record<string, unknown> | null

  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'varchar', length: 64, nullable: true })
  role: string | null

  @Column({ type: 'jsonb', nullable: true })
  screen: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  traceId: string | null

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  toolCallIds: string[]

  @Column({ type: 'varchar', length: 64 })
  category: string

  @Column({ type: 'text', nullable: true })
  contentMasked: string | null

  @Column({ type: 'varchar', length: 32, default: 'new' })
  status: 'new' | 'triaged' | 'proposed' | 'resolved' | 'dismissed'
}
