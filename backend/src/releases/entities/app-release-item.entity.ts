import { Column, Entity } from 'typeorm'
import { ReleaseBaseEntity } from './release-base.entity'

@Entity('app_release_items')
export class AppReleaseItem extends ReleaseBaseEntity {
  @Column({ type: 'uuid' })
  releaseId: string

  @Column({ type: 'varchar', length: 32 })
  itemType: string

  @Column({ type: 'text' })
  itemKey: string

  @Column({ type: 'varchar', length: 16 })
  changeType: 'added' | 'changed' | 'removed' | 'deprecated'

  @Column({ type: 'text', nullable: true })
  beforeDigest: string | null

  @Column({ type: 'text', nullable: true })
  afterDigest: string | null

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null
}
