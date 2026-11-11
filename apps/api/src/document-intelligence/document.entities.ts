import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('document_parse_runs')
@Index('idx_document_run_org_status', ['organizationId', 'status', 'createdAt'])
export class DocumentParseRun extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) assetId: string
  @Column({ type: 'varchar', length: 16, default: 'queued' }) status:
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
  @Column({ type: 'varchar', length: 32, nullable: true }) stage: string | null
  @Column({ type: 'int', default: 0 }) progress: number
  @Column({ type: 'varchar', length: 64, nullable: true }) parser: string | null
  @Column({ type: 'varchar', length: 255, nullable: true }) sourceName: string | null
  @Column({ type: 'int', default: 0 }) pageCount: number
  @Column({ type: 'int', default: 1 }) draftVersion: number
  @Column({ type: 'int', nullable: true }) confirmedVersion: number | null
  @Column({ type: 'text', nullable: true }) error: string | null
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) options: Record<string, unknown>
  @Column({ type: 'varchar', length: 255, nullable: true }) createdBy: string | null
}

@Entity('document_sections')
@Unique('UQ_document_section_run_key', ['runId', 'key'])
@Index('idx_document_section_org_run', ['organizationId', 'runId', 'ordinal'])
export class DocumentSection extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) runId: string
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'varchar', length: 128, nullable: true }) parentKey: string | null
  @Column({ type: 'text' }) title: string
  @Column({ type: 'int', default: 1 }) level: number
  @Column({ type: 'int', default: 0 }) ordinal: number
  @Column({ type: 'text', default: '' }) content: string
  @Column({ type: 'int', nullable: true }) pageNumber: number | null
  @Column({ type: 'jsonb' }) anchor: Record<string, unknown>
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) metadata: Record<string, unknown>
}

@Entity('document_candidates')
@Unique('UQ_document_candidate_run_key', ['runId', 'key'])
@Index('idx_document_candidate_org_run', ['organizationId', 'runId', 'status'])
export class DocumentCandidate extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) runId: string
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'varchar', length: 128 }) sectionKey: string
  @Column({ type: 'varchar', length: 32 }) kind: 'knowledge' | 'concept' | 'relation'
  @Column({ type: 'text' }) title: string
  @Column({ type: 'text', default: '' }) body: string
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0.5 }) confidence: string
  @Column({ type: 'jsonb' }) anchor: Record<string, unknown>
  @Column({ type: 'varchar', length: 16, default: 'pending' }) status:
    | 'pending'
    | 'accepted'
    | 'rejected'
  @Column({ type: 'varchar', length: 64, nullable: true }) targetResourceKey: string | null
  @Column({ type: 'uuid', nullable: true }) targetEntityId: string | null
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) metadata: Record<string, unknown>
  @Column({ type: 'timestamptz', nullable: true }) convertedAt: Date | null
}
