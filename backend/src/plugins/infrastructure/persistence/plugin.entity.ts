import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { PluginStatus, PluginType } from '../../domain/entities/plugin.entity'
import type { PluginManifest } from '../../domain/entities/plugin.entity'

@Entity('plugins')
@Index('idx_plugins_organization_name', ['organizationId', 'name'], {
  unique: true,
})
export class Plugin {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  organizationId: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 50 })
  version: string

  @Column({ type: 'varchar', length: 50 })
  type: PluginType

  @Column({ type: 'jsonb' })
  manifest: PluginManifest

  @Column({ type: 'varchar', length: 50, default: PluginStatus.INSTALLED })
  status: PluginStatus

  @Column({ type: 'varchar', length: 500 })
  installPath: string
}
