import { Column, PrimaryGeneratedColumn } from 'typeorm'

export abstract class KnowledgeBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date
}
