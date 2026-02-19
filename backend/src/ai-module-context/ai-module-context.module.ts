import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AIModule } from '../ai-modules/ai-module.entity'
import { AIModuleTest } from '../ai-modules/ai-module-test.entity'
import { AIModuleReview } from '../ai-modules/ai-module-review.entity'
import {
  AI_MODULE_REPOSITORY,
  AI_MODULE_REVIEW_REPOSITORY,
  AI_MODULE_TEST_REPOSITORY,
  EVENT_PUBLISHER,
} from './domain/repositories'
import { AIModuleRepository } from './infrastructure/persistence/ai-module.repository'
import { AIModuleReviewRepository } from './infrastructure/persistence/ai-module-review.repository'
import { EventBusService } from '../common/events'
import { CreateModuleService } from './application/services/create-module.service'
import { PublishModuleService } from './application/services/publish-module.service'
import { GeneratePatchService } from './application/services/generate-patch.service'
import { SubmitReviewService } from './application/services/submit-review.service'
import { GetModuleService } from './application/services/get-module.service'
import { AI_MODEL_SERVICE, MODULE_REGISTRY_SERVICE, WORKFLOW_SERVICE } from './domain/services'
import { AIModelService } from './infrastructure/external/ai-model.service'
import { ModuleRegistryServiceAdapter } from './infrastructure/external/module-registry.service'
import { WorkflowService } from './infrastructure/external/workflow.service'
import { AIModelsModule } from '../ai-models/ai-models.module'
import { ModuleRegistryModule } from '../module-registry/module-registry.module'
import { WorkflowContextModule } from '../workflow-context/workflow-context.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([AIModule, AIModuleTest, AIModuleReview]),
    AIModelsModule,
    ModuleRegistryModule,
    WorkflowContextModule,
  ],
  providers: [
    {
      provide: AI_MODULE_REPOSITORY,
      useClass: AIModuleRepository,
    },
    {
      provide: AI_MODULE_REVIEW_REPOSITORY,
      useClass: AIModuleReviewRepository,
    },
    {
      provide: EVENT_PUBLISHER,
      useExisting: EventBusService,
    },
    {
      provide: AI_MODEL_SERVICE,
      useClass: AIModelService,
    },
    {
      provide: MODULE_REGISTRY_SERVICE,
      useClass: ModuleRegistryServiceAdapter,
    },
    {
      provide: WORKFLOW_SERVICE,
      useClass: WorkflowService,
    },
    AIModuleRepository,
    AIModelService,
    ModuleRegistryServiceAdapter,
    WorkflowService,
    CreateModuleService,
    PublishModuleService,
    GeneratePatchService,
    SubmitReviewService,
    GetModuleService,
  ],
  exports: [
    CreateModuleService,
    PublishModuleService,
    GeneratePatchService,
    SubmitReviewService,
    GetModuleService,
    AI_MODEL_SERVICE,
    MODULE_REGISTRY_SERVICE,
    WORKFLOW_SERVICE,
    EVENT_PUBLISHER,
  ],
})
export class AIModuleContextModule {}
