import { Module } from '@nestjs/common'
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { AgentEvalModule } from '../agent-eval/agent-eval.module'
import { AgentEvalService } from '../agent-eval/agent-eval.service'
import { OutboxModule } from '../outbox/outbox.module'
import { OutboxService } from '../outbox/outbox.service'
import { AIModulesModule } from '../ai-modules/ai-modules.module'
import { AIModulesService } from '../ai-modules/ai-modules.service'
import { NotificationRecord } from '../notifications/notification.entity'
import { BlueprintService } from '../blueprint/blueprint.service'
import { ReleaseCacheService } from './release-cache.service'
import {
  AppChangeProposal,
  AppDraft,
  AppRelease,
  AppReleaseActivation,
  AppReleaseApproval,
  AppReleaseEvent,
  AppReleaseItem,
  AppUserReleaseView,
} from './entities'
import { ReleasesBuilderController, ReleasesRuntimeController } from './releases.controller'
import { ReleasesService } from './releases.service'
import { ReleaseValidationService } from './release-validation.service'
import { ReleaseIdempotencyService } from './release-idempotency.service'
import { ReleaseNotificationAdapter } from './release-notification.adapter'
import { AppReleaseTestEvidence } from './entities/app-release-test-evidence.entity'
import { ReleaseTestEvidenceService } from './release-test-evidence.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppDraft,
      AppChangeProposal,
      AppRelease,
      AppReleaseItem,
      AppReleaseActivation,
      AppReleaseApproval,
      AppReleaseEvent,
      AppUserReleaseView,
      AppReleaseTestEvidence,
      NotificationRecord,
    ]),
    BlueprintModule,
    AgentEvalModule,
    OutboxModule,
    AIModulesModule,
  ],
  controllers: [ReleasesBuilderController, ReleasesRuntimeController],
  providers: [
    ReleaseIdempotencyService,
    ReleaseCacheService,
    ReleaseNotificationAdapter,
    ReleaseTestEvidenceService,
    {
      // platform-release 只声明端口；应用层在这里把具体实现注入进去。
      provide: ReleaseValidationService,
      useFactory: (
        blueprints: BlueprintService,
        evalService: AgentEvalService,
        evidence: ReleaseTestEvidenceService,
      ) => new ReleaseValidationService(blueprints, evalService, evidence),
      inject: [BlueprintService, AgentEvalService, ReleaseTestEvidenceService],
    },
    {
      provide: ReleasesService,
      useFactory: (
        drafts: never,
        proposals: never,
        releases: never,
        items: never,
        activations: never,
        approvals: never,
        events: never,
        views: never,
        notifications: ReleaseNotificationAdapter,
        validation: ReleaseValidationService,
        outbox: OutboxService,
        dataSource: DataSource,
        aiModules: AIModulesService,
        cache: ReleaseCacheService,
      ) =>
        new ReleasesService(
          drafts,
          proposals,
          releases,
          items,
          activations,
          approvals,
          events,
          views,
          notifications,
          validation,
          outbox,
          dataSource,
          aiModules,
          cache,
        ),
      inject: [
        getRepositoryToken(AppDraft),
        getRepositoryToken(AppChangeProposal),
        getRepositoryToken(AppRelease),
        getRepositoryToken(AppReleaseItem),
        getRepositoryToken(AppReleaseActivation),
        getRepositoryToken(AppReleaseApproval),
        getRepositoryToken(AppReleaseEvent),
        getRepositoryToken(AppUserReleaseView),
        ReleaseNotificationAdapter,
        ReleaseValidationService,
        OutboxService,
        DataSource,
        AIModulesService,
        ReleaseCacheService,
      ],
    },
  ],
  exports: [ReleasesService, ReleaseValidationService, ReleaseIdempotencyService],
})
export class ReleasesModule {}
