import { Entity, Column, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export enum LabReportStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  FINALIZED = 'finalized',
}

export enum LabReportFormat {
  PDF = 'pdf',
  DOCX = 'docx',
  XLSX = 'xlsx',
  XML = 'xml',
}

@Entity('lab_reports')
@Index('idx_lab_report_org', ['organizationId'])
@Index('idx_lab_report_org_status', ['organizationId', 'status'])
export class LabReport extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string

  @Column({ type: 'uuid', nullable: true })
  sampleId: string | null

  @Column({ type: 'uuid', nullable: true })
  workflowExecutionId: string | null

  @Column({ type: 'varchar', length: 50, default: LabReportStatus.DRAFT })
  status: LabReportStatus

  @Column({ type: 'varchar', length: 20, default: LabReportFormat.PDF })
  format: LabReportFormat

  @Column({ type: 'varchar', length: 100, default: 'en' })
  language: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  templateName: string | null

  @Column({ type: 'uuid', nullable: true })
  generatedById: string | null

  @Column({ type: 'timestamp', nullable: true })
  generatedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  finalizedById: string | null

  @Column({ type: 'timestamp', nullable: true })
  finalizedAt: Date | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null
}
