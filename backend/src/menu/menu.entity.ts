import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string

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

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
