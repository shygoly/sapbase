import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'
import { LabMethod } from './lab-method.entity'

@Entity('lab_method_versions')
@Index('idx_lab_method_version_org', ['organizationId'])
@Index('idx_lab_method_version_uniq', ['organizationId', 'methodId', 'version'], { unique: true })
export class LabMethodVersion extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  methodId: string

  @ManyToOne(() => LabMethod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'methodId' })
  method: LabMethod

  @Column({ type: 'int' })
  version: number

  @Column({ type: 'varchar', length: 50, default: 'active' })
  versionStatus: string

  @Column({ type: 'jsonb', nullable: true })
  definition: Record<string, unknown> | null
}
