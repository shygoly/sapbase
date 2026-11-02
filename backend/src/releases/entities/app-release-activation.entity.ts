import { Column, Entity } from 'typeorm'
import { ReleaseBaseEntity } from './release-base.entity'

@Entity('app_release_activations')
export class AppReleaseActivation extends ReleaseBaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string

  @Column({ type: 'uuid' })
  appInstallationId: string

  @Column({ type: 'uuid' })
  releaseId: string

  @Column({ type: 'varchar', length: 16 })
  action: 'activate' | 'upgrade' | 'rollback'

  @Column({ type: 'varchar', length: 32, default: 'scheduled' })
  status: 'scheduled' | 'active' | 'superseded' | 'rolled_back' | 'cancelled'

  @Column({ type: 'jsonb', nullable: true })
  cohort: Record<string, unknown> | null

  @Column({ type: 'timestamptz', default: () => 'now()' })
  effectiveAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  activatedBy: string | null

  @Column({ type: 'text', nullable: true })
  reason: string | null

  @Column({ type: 'uuid', nullable: true })
  fromReleaseId: string | null
}
