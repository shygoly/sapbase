import { Entity, Column, ManyToOne, OneToMany, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('menu_items')
@Index('idx_menu_organization', ['organizationId'])
export class MenuItem extends TenantAwareEntity {
  @Column()
  label: string

  @Column({ nullable: true })
  path: string

  @Column({ nullable: true })
  icon: string

  @Column('simple-array', { nullable: true })
  permissions: string[]

  @Column({ default: true })
  visible: boolean

  @Column({ default: false })
  disabled: boolean

  @Column({ default: 0 })
  order: number

  /** 台面：portal（业务壳）/ console（平台治理）/ both。 */
  @Column({ type: 'varchar', length: 16, default: 'both' })
  surface: 'portal' | 'console' | 'both'

  /** Runtime 组件键白名单；未知值回退默认组件。 */
  @Column({ type: 'varchar', length: 64, nullable: true })
  componentKey: string | null

  /** 交互标识（pagination/confirm/draft/virtualization）。 */
  @Column({ type: 'jsonb', nullable: true })
  interaction: Record<string, unknown> | null

  @ManyToOne(() => MenuItem, (item) => item.children, { nullable: true })
  parent: MenuItem

  @OneToMany(() => MenuItem, (item) => item.parent)
  children: MenuItem[]
}
