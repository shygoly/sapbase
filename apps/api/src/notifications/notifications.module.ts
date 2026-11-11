import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogsModule } from '@sap/platform-core/audit-logs/audit-logs.module'
import { ScopeMembership } from '@sap/platform-core/data-scope/entities/scope-membership.entity'
import { ScopeNode } from '@sap/platform-core/data-scope/entities/scope-node.entity'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { EventBusModule } from '../common/events/event-bus.module'
import { OrganizationMember } from '../organizations/organization-member.entity'
import { OrganizationMemberRole } from '../identity/organization-member-role.entity'
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
import { NotificationCleanupRun } from './notification-cleanup-run.entity'
import { NotificationRetentionService } from './notification-retention.service'
import { AnnouncementFanoutJobService } from './announcement-fanout-job.service'
import { AnnouncementsService } from './announcements.service'
import { AnnouncementsController } from './announcements.controller'

@Module({
  imports: [
    EventBusModule,
    JobsModule,
    AuditLogsModule,
    TypeOrmModule.forFeature([
      NotificationRecord,
      NotificationPreference,
      Announcement,
      AnnouncementAudience,
      AnnouncementDelivery,
      NotificationCleanupRun,
      ScopeNode,
      ScopeMembership,
      User,
      OrganizationMember,
      OrganizationMemberRole,
      BlueprintApproval,
    ]),
  ],
  controllers: [NotificationsController, InboxController, AnnouncementsController],
  providers: [
    NotificationService,
    NotificationSubscriber,
    InboxService,
    NotificationPreferencesService,
    AnnouncementsService,
    AnnouncementFanoutJobService,
    NotificationRetentionService,
  ],
  exports: [
    NotificationService,
    InboxService,
    NotificationPreferencesService,
    AnnouncementsService,
    AnnouncementFanoutJobService,
    NotificationRetentionService,
  ],
})
export class NotificationsModule {}
