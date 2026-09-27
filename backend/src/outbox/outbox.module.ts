import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EventBusModule } from '../common/events/event-bus.module'
import { OutboxController } from './outbox.controller'
import { OutboxDelivery } from './outbox-delivery.entity'
import { OutboxDispatcherService } from './outbox-dispatcher.service'
import { OutboxEvent } from './outbox-event.entity'
import { OutboxService } from './outbox.service'

@Module({
  imports: [EventBusModule, TypeOrmModule.forFeature([OutboxEvent, OutboxDelivery])],
  controllers: [OutboxController],
  providers: [OutboxService, OutboxDispatcherService],
  exports: [OutboxService, OutboxDispatcherService],
})
export class OutboxModule {}
