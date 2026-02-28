import { Entity, Column, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export enum LabMethodStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  RETIRED = 'retired',
}

@Entity('lab_methods')
@Index('idx_lab_method_org', ['organizationId'])
@Index('idx_lab_method_code_org', ['organizationId', 'methodCode'], { unique: true })
export class LabMethod extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 100 })
  methodCode: string

  @Column({ type: 'varchar', length: 255 })
  methodName: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'varchar', length: 50, default: LabMethodStatus.DRAFT })
  status: LabMethodStatus

  @Column({ type: 'int', default: 1 })
  currentVersion: number
}
