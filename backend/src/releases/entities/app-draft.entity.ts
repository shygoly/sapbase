import { Column, Entity } from 'typeorm'
import { ReleaseBaseEntity } from './release-base.entity'

@Entity('app_drafts')
export class AppDraft extends ReleaseBaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string

  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'uuid', nullable: true })
  baseReleaseId: string | null

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: 'draft' | 'frozen' | 'archived'

  @Column({ type: 'integer', default: 1 })
  revision: number

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  content: Record<string, unknown>

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null
}
