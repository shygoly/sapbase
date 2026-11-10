import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ScopeMembership } from '@sap/platform-core/data-scope/entities/scope-membership.entity'
import { JobsModule } from '@sap/platform-core/jobs/jobs.module'
import { OrganizationMemberRole } from '../identity/organization-member-role.entity'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'
import { ReviewCheckRegistry, ReviewCheckService } from './review-check'
import { ReviewCheckJobService } from './review-check-job.service'
import { ReviewComment } from './review-comment.entity'
import { ReviewDecisionService } from './review-decision.service'
import { ReviewEvent } from './review-event.entity'
import { ReviewAssigneeService } from './review-assignee.service'
import { WorkItem } from './work-item.entity'
import { WorkItemsService } from './work-items.service'

@Module({
  imports: [
    JobsModule,
    TypeOrmModule.forFeature([
      BlueprintApproval,
      ReviewComment,
      ReviewEvent,
      WorkItem,
      OrganizationMemberRole,
      ScopeMembership,
    ]),
  ],
  providers: [
    {
      provide: ReviewCheckRegistry,
      useFactory: () => new ReviewCheckRegistry(),
    },
    {
      provide: ReviewCheckService,
      useFactory: (registry: ReviewCheckRegistry) => new ReviewCheckService(registry),
      inject: [ReviewCheckRegistry],
    },
    WorkItemsService,
    ReviewAssigneeService,
    ReviewDecisionService,
    ReviewCheckJobService,
  ],
  exports: [
    ReviewCheckRegistry,
    ReviewCheckService,
    ReviewCheckJobService,
    WorkItemsService,
    ReviewAssigneeService,
    ReviewDecisionService,
  ],
})
export class ReviewModule {}
