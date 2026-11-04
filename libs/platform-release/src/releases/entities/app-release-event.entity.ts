import { Column, Entity } from 'typeorm'
import { ReleaseBaseEntity } from './release-base.entity'

@Entity('app_release_events')
export class AppReleaseEvent extends ReleaseBaseEntity {
  @Column({ type: 'uuid' })
  releaseId: string

  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null

  @Column({ type: 'varchar', length: 64 })
  event: string

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  actorAgent: string | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>
}
