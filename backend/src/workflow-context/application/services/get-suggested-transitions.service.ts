import { Inject, Injectable } from '@nestjs/common'
import type { IAiSuggestionService, SuggestedTransition } from '../../domain/services'
import { AI_SUGGESTION_SERVICE } from '../../domain/services'
import type { IWorkflowInstanceRepository } from '../../domain/repositories'
import type { IWorkflowDefinitionRepository } from '../../domain/repositories'
import {
  WORKFLOW_INSTANCE_REPOSITORY,
  WORKFLOW_DEFINITION_REPOSITORY,
} from '../../domain/repositories'

@Injectable()
export class GetSuggestedTransitionsService {
  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly workflowInstanceRepository: IWorkflowInstanceRepository,
    @Inject(WORKFLOW_DEFINITION_REPOSITORY)
    private readonly workflowDefinitionRepository: IWorkflowDefinitionRepository,
    @Inject(AI_SUGGESTION_SERVICE)
    private readonly aiSuggestionService: IAiSuggestionService,
  ) {}

  async getSuggestedTransitions(
    instanceId: string,
    organizationId: string,
    entitySnapshot?: Record<string, unknown>,
  ): Promise<SuggestedTransition[]> {
    const instance = await this.workflowInstanceRepository.findById(
      instanceId,
      organizationId,
    )
    if (!instance || instance.status !== 'running') {
      return []
    }

    const workflow = await this.workflowDefinitionRepository.findById(
      instance.workflowDefinitionId,
      organizationId,
    )
    if (!workflow) {
      return []
    }

    const toStates = workflow.transitions
      .filter((t) => t.from === instance.currentState)
      .map((t) => t.to)

    if (toStates.length === 0) {
      return []
    }

    return this.aiSuggestionService.getSuggestedTransitions(
      instanceId,
      organizationId,
      {
        currentState: instance.currentState,
        entityType: instance.entityType,
        toStates,
      },
      entitySnapshot,
    )
  }
}
