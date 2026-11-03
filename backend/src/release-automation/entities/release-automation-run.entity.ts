import { Column, Entity } from 'typeorm'
import { ReleaseAutomationBaseEntity } from './release-automation-base.entity'

@Entity('release_automation_runs')
export class ReleaseAutomationRun extends ReleaseAutomationBaseEntity {
  @Column({ type: 'uuid', nullable: true })
  policyId: string | null

  @Column({ type: 'uuid', nullable: true })
  proposalId: string | null

  @Column({ type: 'uuid', nullable: true })
  releaseId: string | null

  @Column({ type: 'varchar', length: 32 })
  action: 'publish' | 'activate' | 'rollback' | 'review' | 'disable'

  @Column({ type: 'varchar', length: 32 })
  status: 'success' | 'failure'

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  actorAgent: string | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details: Record<string, unknown>
}
