import { Column, Entity, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('blueprint_journal_entries')
@Unique('UQ_cabe470d13abf1ab79840147daf', ['recordId', 'ruleId', 'account', 'side'])
export class BlueprintJournalEntry extends TenantAwareEntity {
  @Column()
  blueprintId: string

  @Column()
  blueprintVersion: string

  @Column()
  ruleId: string

  @Column()
  event: string

  @Column()
  entity: string

  @Column({ type: 'uuid' })
  recordId: string

  @Column()
  account: string

  @Column()
  side: 'debit' | 'credit'

  /** 整数小单位；与 money.ts 的 units 同构。 */
  @Column({ type: 'bigint' })
  amountUnits: string

  @Column({ type: 'int' })
  scale: number
}
