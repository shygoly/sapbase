import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EventBusModule } from '../common/events/event-bus.module'
import { OrganizationMember } from '../organizations/organization-member.entity'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { User } from '../users/user.entity'
import { NotificationService } from '../websocket/services/notification.service'
import { InboxController } from './inbox.controller'
import { InboxService } from './inbox.service'
import { NotificationRecord } from './notification.entity'
import { NotificationPreference } from './notification-preference.entity'
import { Announcement } from './announcement.entity'
import { AnnouncementAudience } from './announcement-audience.entity'
import { AnnouncementDelivery } from './announcement-delivery.entity'
import { NotificationSubscriber } from './notification-subscriber'
import { NotificationsController } from './notifications.controller'
import { NotificationPreferencesService } from './notification-preferences.service'

@Module({
  imports: [
    EventBusModule,
    TypeOrmModule.forFeature([
      NotificationRecord,
      NotificationPreference,
      Announcement,
      AnnouncementAudience,
      AnnouncementDelivery,
      User,
      OrganizationMember,
      BlueprintApproval,
    ]),
  ],
  controllers: [NotificationsController, InboxController],
  providers: [
    NotificationService,
    NotificationSubscriber,
    InboxService,
    NotificationPreferencesService,
  ],
  exports: [NotificationService, InboxService, NotificationPreferencesService],
})
export class NotificationsModule {}
