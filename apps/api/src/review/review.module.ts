import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Asset } from '@sap/platform-core/assets/asset.entity'
import { ScopeBinding } from '@sap/platform-core/data-scope/entities/scope-binding.entity'
import { ScopeMembership } from '@sap/platform-core/data-scope/entities/scope-membership.entity'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { EventBusModule } from '../common/events/event-bus.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { BlueprintRecord } from '../semantic-runtime/blueprint-record.entity'
import { OrganizationMemberRole } from '../identity/organization-member-role.entity'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { ReviewCheckRegistry, ReviewCheckService } from './review-check'
import { createDefaultReviewCheckRegistry } from './review-check.builtin'
import { ReviewCheckJobService } from './review-check-job.service'
import { ReviewComment } from './review-comment.entity'
import { ReviewDecisionService } from './review-decision.service'
import { ReviewEvent } from './review-event.entity'
import { ReviewAssigneeService } from './review-assignee.service'
import { ReviewDelegation } from './review-delegation.entity'
import { ReviewDelegationService } from './review-delegation.service'
import { ReviewSlaService } from './review-sla.service'
import { ReviewReconcileJobService } from './review-reconcile-job.service'
import { ReviewWorkItemSubscriber } from './review-work-item.subscriber'
import { ReviewController } from './review.controller'
import { WorkItem } from './work-item.entity'
import { WorkItemsService } from './work-items.service'

@Module({
  imports: [
    JobsModule,
    EventBusModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      BlueprintApproval,
      BlueprintRecord,
      ReviewComment,
      ReviewEvent,
      ReviewDelegation,
      WorkItem,
      OrganizationMemberRole,
      ScopeMembership,
      ScopeBinding,
      Asset,
    ]),
  ],
  controllers: [ReviewController],
  providers: [
    {
      provide: ReviewCheckRegistry,
      useFactory: () => createDefaultReviewCheckRegistry(),
    },
    {
      provide: ReviewCheckService,
      useFactory: (registry: ReviewCheckRegistry) => new ReviewCheckService(registry),
      inject: [ReviewCheckRegistry],
    },
    WorkItemsService,
    ReviewAssigneeService,
    ReviewDecisionService,
    ReviewDelegationService,
    ReviewSlaService,
    ReviewReconcileJobService,
    ReviewWorkItemSubscriber,
    ReviewCheckJobService,
  ],
  exports: [
    ReviewCheckRegistry,
    ReviewCheckService,
    ReviewCheckJobService,
    WorkItemsService,
    ReviewAssigneeService,
    ReviewDecisionService,
    ReviewDelegationService,
    ReviewSlaService,
  ],
})
export class ReviewModule {}
