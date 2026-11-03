import { Column, Entity } from 'typeorm'
import { ReleaseBaseEntity } from './release-base.entity'

@Entity('app_user_release_views')
export class AppUserReleaseView extends ReleaseBaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string

  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'uuid' })
  appInstallationId: string

  @Column({ type: 'uuid' })
  lastSeenReleaseId: string

  @Column({ type: 'timestamptz', default: () => 'now()' })
  firstSeenAt: Date

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastSeenAt: Date
}
