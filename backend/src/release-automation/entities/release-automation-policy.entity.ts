import { Column, Entity } from 'typeorm'
import { ReleaseAutomationBaseEntity } from './release-automation-base.entity'

@Entity('release_automation_policies')
export class ReleaseAutomationPolicy extends ReleaseAutomationBaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string

  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'varchar', length: 8, default: 'A1' })
  autonomy: 'A1' | 'A2'

  @Column({ type: 'boolean', default: false })
  enabled: boolean

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  allowedChangeClasses: string[]

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  guardrails: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'[5,25,100]'::jsonb" })
  canaryStages: number[]

  @Column({ type: 'boolean', default: false })
  autoRollbackEnabled: boolean

  @Column({ type: 'integer', default: 0 })
  consecutiveCleanRuns: number

  @Column({ type: 'timestamptz', nullable: true })
  lastReviewedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string | null
}
