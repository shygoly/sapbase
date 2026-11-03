import { Column, Entity } from 'typeorm'
import { ReleaseBaseEntity } from './release-base.entity'

@Entity('app_release_approvals')
export class AppReleaseApproval extends ReleaseBaseEntity {
  @Column({ type: 'uuid', nullable: true })
  proposalId: string | null

  @Column({ type: 'uuid', nullable: true })
  releaseId: string | null

  @Column({ type: 'uuid' })
  approverId: string

  @Column({ type: 'varchar', length: 32 })
  role: 'owner' | 'tech_lead' | 'security' | 'platform_admin'

  @Column({ type: 'varchar', length: 16 })
  decision: 'approved' | 'rejected'

  @Column({ type: 'text', nullable: true })
  comment: string | null
}
