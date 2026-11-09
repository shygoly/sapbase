import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('app_release_test_evidence')
export class AppReleaseTestEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date

  @Column({ type: 'uuid' })
  organizationId: string

  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'varchar', length: 64, nullable: true })
  commitSha: string | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  suiteSummary: Record<string, unknown>

  @Column({ type: 'varchar', length: 128 })
  jestOutputDigest: string

  @Column({ type: 'timestamptz' })
  ranAt: Date

  @Column({ type: 'uuid', nullable: true })
  ranBy: string | null
}
