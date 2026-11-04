import { Column, Entity } from 'typeorm'
import { ReleaseBaseEntity } from './release-base.entity'

@Entity('app_releases')
export class AppRelease extends ReleaseBaseEntity {
  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null

  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'varchar', length: 32 })
  version: string

  @Column({ type: 'varchar', length: 32 })
  channel: 'preview' | 'canary' | 'stable'

  @Column({ type: 'varchar', length: 32, default: 'building' })
  status: 'building' | 'published' | 'superseded' | 'revoked' | 'failed'

  @Column({ type: 'uuid', nullable: true })
  baseReleaseId: string | null

  @Column({ type: 'jsonb' })
  manifest: Record<string, unknown>

  @Column({ type: 'jsonb' })
  changelog: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  compatibility: Record<string, unknown>

  @Column({ type: 'varchar', length: 80 })
  digest: string

  @Column({ type: 'text' })
  signature: string

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  publishedBy: string | null

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null
}
