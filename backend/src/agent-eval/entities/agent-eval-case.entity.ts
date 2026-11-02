import { Column, Entity } from 'typeorm'
import { EvalBaseEntity } from './eval-base.entity'

@Entity('agent_eval_cases')
export class AgentEvalCase extends EvalBaseEntity {
  @Column({ type: 'varchar', length: 32 })
  suite: 'faq' | 'navigate' | 'query' | 'write' | 'refusal' | 'injection' | 'release'

  @Column({ type: 'varchar', length: 128 })
  caseKey: string

  @Column({ type: 'integer', default: 1 })
  version: number

  @Column({ type: 'jsonb' })
  input: Record<string, unknown>

  @Column({ type: 'jsonb' })
  expected: Record<string, unknown>

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: 'active' | 'retired'
}
