import { Entity, Column, ManyToOne, OneToMany } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'

@Entity('menu_items')
export class MenuItem extends BaseEntity {
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

  @Column({ default: 0 })
  order: number

  @ManyToOne(() => MenuItem, (item) => item.children, { nullable: true })
  parent: MenuItem

  @OneToMany(() => MenuItem, (item) => item.parent)
  children: MenuItem[]
}
