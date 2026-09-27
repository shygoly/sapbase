import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { OutboxEvent } from './outbox-event.entity'

@Entity('outbox_deliveries')
@Unique('UQ_613903349ab26e7092581449581', ['eventId', 'subscriber'])
export class OutboxDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => OutboxEvent, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'eventId' })
  event: OutboxEvent

  @Column({ type: 'uuid' })
  eventId: string

  @Column({ type: 'text' })
  subscriber: string

  @CreateDateColumn()
  createdAt: Date
}
