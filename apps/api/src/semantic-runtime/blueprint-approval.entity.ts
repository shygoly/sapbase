import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('blueprint_approvals')
@Unique('UQ_2d647c4c3aba8401909305918b1', ['recordId', 'ruleId', 'stepIndex'])
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
  stepIndex: number

  @Column()
  role: string

  @Column()
  status: 'pending' | 'approved' | 'rejected'

  @Column({ type: 'varchar', nullable: true })
  actor?: string

  @Column({ type: 'timestamp', nullable: true })
  decidedAt?: Date
}
