import { Entity, Column, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { AIModule } from './ai-module.entity'

export enum TestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('ai_module_tests')
export class AIModuleTest extends BaseEntity {
  @ManyToOne(() => AIModule, { onDelete: 'CASCADE' })
  module: AIModule

  @Column()
  moduleId: string

  @Column({ type: 'varchar', length: 255 })
  testName: string

  @Column({ type: 'varchar', length: 100 })
  entityType: string // 'Customer', 'Order', etc.

  @Column({ type: 'varchar', length: 50, default: TestStatus.PENDING })
  status: TestStatus

  @Column({ type: 'text', nullable: true })
  errorMessage: string

  @Column({ type: 'jsonb', nullable: true })
  testData: Record<string, any>

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any>

  @Column({ type: 'timestamp', nullable: true })
  executedAt: Date

  @Column({ type: 'integer', nullable: true })
  duration: number // milliseconds
}
