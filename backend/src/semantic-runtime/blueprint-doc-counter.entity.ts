import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Organization } from '../organizations/organization.entity'

/**
 * 单据单号按租户分配的计数器。
 * 主键 = (blueprintId, organizationId, entity, period)，与唯一索引分区一致。
 */
@Entity('blueprint_doc_counters')
export class BlueprintDocCounter {
  @PrimaryColumn()
  blueprintId: string

  @PrimaryColumn({ type: 'uuid' })
  organizationId: string

  @PrimaryColumn()
  entity: string

  @PrimaryColumn()
  period: string

  @Column({ type: 'int', default: 0 })
  seq: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization
}
