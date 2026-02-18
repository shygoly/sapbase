import { Entity, Column, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { ModuleRegistry } from './module-registry.entity'

export enum HealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  ERROR = 'error',
}

@Entity('module_statistics')
export class ModuleStatistics extends BaseEntity {
  @ManyToOne(() => ModuleRegistry, { onDelete: 'CASCADE' })
  module: ModuleRegistry

  @Column()
  moduleId: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  entity: string

  @Column({ type: 'int', default: 0 })
  recordCount: number

  @Column({ type: 'timestamp', nullable: true })
  lastUpdate: Date

  @Column({ type: 'int', default: 0 })
  errorCount: number

  @Column({ type: 'float', nullable: true })
  averageResponseTime: number

  @Column({ type: 'varchar', length: 50, default: HealthStatus.HEALTHY })
  healthStatus: HealthStatus

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  collectedAt: Date
}
