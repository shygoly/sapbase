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

  @ManyToOne(() => MenuItem, (item) => item.children, { nullable: true })
  parent: MenuItem

  @OneToMany(() => MenuItem, (item) => item.parent)
  children: MenuItem[]
}
