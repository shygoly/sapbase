import { Column, Entity } from 'typeorm'
import { EvalBaseEntity } from './eval-base.entity'

@Entity('agent_eval_runs')
export class AgentEvalRun extends EvalBaseEntity {
  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null

  @Column({ type: 'uuid', nullable: true })
  releaseId: string | null

  @Column({ type: 'varchar', length: 128, nullable: true })
  skillVersion: string | null

  @Column({ type: 'varchar', length: 128, nullable: true })
  modelId: string | null

  @Column({ type: 'varchar', length: 32 })
  suite: string

  @Column({ type: 'integer', default: 0 })
  passed: number

  @Column({ type: 'integer', default: 0 })
  failed: number

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details: Record<string, unknown>

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null
}
