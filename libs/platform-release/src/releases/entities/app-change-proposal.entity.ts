import { Column, Entity } from 'typeorm'
import { ReleaseBaseEntity } from './release-base.entity'

@Entity('app_change_proposals')
export class AppChangeProposal extends ReleaseBaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string

  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'uuid' })
  draftId: string

  @Column({ type: 'uuid', nullable: true })
  baseReleaseId: string | null

  @Column({ type: 'varchar', length: 32 })
  type: string

  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" })
  areas: string[]

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status:
    | 'draft'
    | 'submitted'
    | 'validating'
    | 'validated'
    | 'approved'
    | 'published'
    | 'rejected'
    | 'withdrawn'

  @Column({ type: 'text' })
  title: string

  @Column({ type: 'text' })
  summary: string

  @Column({ type: 'jsonb' })
  diff: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  evidence: unknown[]

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  risk: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  testPlan: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  rollbackPlan: Record<string, unknown>

  @Column({ type: 'varchar', length: 64, nullable: true })
  createdByAgent: string | null

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  publishedReleaseId: string | null

  /** 实例演进绑定的平台版本；缺失时不得批准。 */
  @Column({ type: 'varchar', length: 64, nullable: true })
  platformVersion: string | null

  /** 实例演进范围（blueprint 层 area 列表）；缺失时不得批准。 */
  @Column({ type: 'text', array: true, nullable: true })
  evolutionScope: string[] | null
}
