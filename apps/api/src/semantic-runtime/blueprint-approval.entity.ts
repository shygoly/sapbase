import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('blueprint_approvals')
@Unique('UQ_blueprint_approval_record_rule_round_step', ['recordId', 'ruleId', 'round', 'stepIndex'])
@Index('IDX_2d647c4c3aba8401909305918b', ['recordId', 'ruleId', 'stepIndex'])
export class BlueprintApproval extends TenantAwareEntity {
  @Column()
  blueprintId: string

  @Column()
  blueprintVersion: string

  @Column()
  entity: string

  @Column({ type: 'uuid' })
  recordId: string

  @Column()
  ruleId: string

  @Column({ type: 'int' })
  round: number

  @Column({ type: 'int' })
  stepIndex: number

  @Column()
  role: string

  @Column()
  status: 'pending' | 'approved' | 'rejected'

  @Column({ type: 'varchar', length: 16, default: 'human' })
  kind: 'human' | 'check'

  @Column({ type: 'jsonb', nullable: true })
  selector: Record<string, unknown> | null

  @Column({ type: 'jsonb', nullable: true })
  assignee: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 128, nullable: true })
  checkProvider: string | null

  @Column({ type: 'jsonb', nullable: true })
  checkResult: Record<string, unknown> | null

  @Column({ type: 'text', nullable: true })
  comment: string | null

  @Column({ type: 'uuid', nullable: true })
  decidedBy: string | null

  @Column({ type: 'timestamptz', nullable: true })
  dueAt: Date | null

  @Column({ type: 'varchar', nullable: true })
  actor?: string

  @Column({ type: 'timestamp', nullable: true })
  decidedAt?: Date
}
