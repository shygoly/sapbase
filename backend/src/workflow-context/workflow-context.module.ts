import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { WorkflowDefinition } from '../workflows/workflow-definition.entity'
import { WorkflowInstance } from '../workflows/workflow-instance.entity'
import { WorkflowHistory } from '../workflows/workflow-history.entity'
import {
  WORKFLOW_DEFINITION_REPOSITORY,
  WORKFLOW_INSTANCE_REPOSITORY,
  WORKFLOW_HISTORY_REPOSITORY,
  EVENT_PUBLISHER,
} from './domain/repositories'
import { WorkflowDefinitionRepository } from './infrastructure/persistence/workflow-definition.repository'
import { WorkflowInstanceRepository } from './infrastructure/persistence/workflow-instance.repository'
import { WorkflowHistoryRepository } from './infrastructure/persistence/workflow-history.repository'
import { EventBusService } from '../common/events'
import { StartWorkflowInstanceService } from './application/services/start-workflow-instance.service'
import { GetWorkflowInstanceService } from './application/services/get-workflow-instance.service'
import { ExecuteTransitionService } from './application/services/execute-transition.service'
import { GetSuggestedTransitionsService } from './application/services/get-suggested-transitions.service'
import { GetAvailableTransitionsService } from './application/services/get-available-transitions.service'
import { CancelWorkflowInstanceService } from './application/services/cancel-workflow-instance.service'
import { AiGuardEvaluatorService } from './infrastructure/external/ai-guard-evaluator.service'
import { AiSuggestionService } from './infrastructure/external/ai-suggestion.service'
import { AI_GUARD_EVALUATOR, AI_SUGGESTION_SERVICE } from './domain/services'
import { AIModelsModule } from '../ai-models/ai-models.module'
import { WorkflowAutoSuggestionLog } from '../workflows/workflow-auto-suggestion-log.entity'
import { WorkflowAutoTransitionJob } from './infrastructure/jobs/workflow-auto-transition.job'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowDefinition,
      WorkflowInstance,
      WorkflowHistory,
      WorkflowAutoSuggestionLog,
    ]),
    AIModelsModule,
  ],
  providers: [
    {
      provide: WORKFLOW_DEFINITION_REPOSITORY,
      useClass: WorkflowDefinitionRepository,
    },
    {
      provide: WORKFLOW_INSTANCE_REPOSITORY,
      useClass: WorkflowInstanceRepository,
    },
    {
      provide: WORKFLOW_HISTORY_REPOSITORY,
      useClass: WorkflowHistoryRepository,
    },
    {
      provide: EVENT_PUBLISHER,
      useExisting: EventBusService,
    },
    {
      provide: AI_GUARD_EVALUATOR,
      useClass: AiGuardEvaluatorService,
    },
    {
      provide: AI_SUGGESTION_SERVICE,
      useClass: AiSuggestionService,
    },
    AiGuardEvaluatorService,
    AiSuggestionService,
    StartWorkflowInstanceService,
    GetWorkflowInstanceService,
    ExecuteTransitionService,
    GetSuggestedTransitionsService,
    GetAvailableTransitionsService,
    CancelWorkflowInstanceService,
    WorkflowAutoTransitionJob,
  ],
  exports: [
    WORKFLOW_DEFINITION_REPOSITORY,
    WORKFLOW_INSTANCE_REPOSITORY,
    WORKFLOW_HISTORY_REPOSITORY,
    StartWorkflowInstanceService,
    GetWorkflowInstanceService,
    ExecuteTransitionService,
    GetSuggestedTransitionsService,
    GetAvailableTransitionsService,
    CancelWorkflowInstanceService,
    EVENT_PUBLISHER,
  ],
})
export class WorkflowContextModule {}
