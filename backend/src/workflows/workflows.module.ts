import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { WorkflowDefinition } from './workflow-definition.entity'
import { WorkflowInstance } from './workflow-instance.entity'
import { WorkflowHistory } from './workflow-history.entity'
import { WorkflowAutoSuggestionLog } from './workflow-auto-suggestion-log.entity'
import { WorkflowDefinitionService } from './workflow-definition.service'
import { WorkflowInstanceService } from './workflow-instance.service'
import { TransitionEngineService } from './transition-engine.service'
import { WorkflowHistoryService } from './workflow-history.service'
import { WorkflowConverterService } from './workflow-converter.service'
import { EntityStateUpdaterRegistry } from './entity-state-updater.registry'
import { WorkflowGuardAiService } from './workflow-guard-ai.service'
import { WorkflowSuggestionService } from './workflow-suggestion.service'
import { WorkflowsController, WorkflowInstancesController } from './workflows.controller'
import { CacheModule } from '../cache/cache.module'
import { AIModelsModule } from '../ai-models/ai-models.module'
import { User } from '../users/user.entity'
import { WorkflowContextModule } from '../workflow-context/workflow-context.module'

@Module({
  imports: [
    WorkflowContextModule,
    TypeOrmModule.forFeature([
      WorkflowDefinition,
      WorkflowInstance,
      WorkflowHistory,
      WorkflowAutoSuggestionLog,
      User,
    ]),
    CacheModule,
    AIModelsModule,
  ],
  controllers: [WorkflowsController, WorkflowInstancesController],
  providers: [
    WorkflowDefinitionService,
    WorkflowInstanceService,
    TransitionEngineService,
    WorkflowHistoryService,
    WorkflowConverterService,
    EntityStateUpdaterRegistry,
    WorkflowGuardAiService,
    WorkflowSuggestionService,
  ],
  exports: [
    WorkflowDefinitionService,
    WorkflowInstanceService,
    TransitionEngineService,
    WorkflowHistoryService,
    WorkflowConverterService,
    EntityStateUpdaterRegistry,
  ],
})
export class WorkflowsModule {}
