import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BlueprintModule } from '../blueprint/blueprint.module'
import { AgentEvalModule } from '../agent-eval/agent-eval.module'
import { OutboxModule } from '../outbox/outbox.module'
import { AIModulesModule } from '../ai-modules/ai-modules.module'
import { NotificationRecord } from '../notifications/notification.entity'
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
      NotificationRecord,
    ]),
    BlueprintModule,
    AgentEvalModule,
    OutboxModule,
    AIModulesModule,
  ],
  controllers: [ReleasesBuilderController, ReleasesRuntimeController],
  providers: [ReleasesService, ReleaseValidationService, ReleaseIdempotencyService, ReleaseCacheService],
  exports: [ReleasesService, ReleaseValidationService, ReleaseIdempotencyService],
})
export class ReleasesModule {}
