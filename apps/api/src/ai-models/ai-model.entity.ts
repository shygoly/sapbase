import { Entity, Column } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'

export enum AIModelProvider {
  KIMI = 'kimi',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

export enum AIModelStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TESTING = 'testing',
}

@Entity('ai_models')
export class AIModel extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string

  @Column({ type: 'varchar', length: 50 })
  provider: AIModelProvider

  @Column({ type: 'varchar', length: 255, nullable: true })
  apiKey: string

  @Column({ type: 'varchar', length: 500, nullable: true })
  baseUrl: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string

  @Column({ type: 'varchar', length: 50, default: AIModelStatus.INACTIVE })
  status: AIModelStatus

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any>

  @Column({ type: 'timestamp', nullable: true })
  lastTestedAt: Date

  @Column({ type: 'boolean', default: false })
  isDefault: boolean
}
