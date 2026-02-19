import { Injectable, Inject } from '@nestjs/common'
import type { IWorkflowInstanceRepository } from '../../../workflow-context/domain/repositories'
import type { IWorkflowDefinitionRepository } from '../../../workflow-context/domain/repositories'
import { WORKFLOW_INSTANCE_REPOSITORY, WORKFLOW_DEFINITION_REPOSITORY } from '../../../workflow-context/domain/repositories'
import type { IWorkflowService } from '../../domain/services'

@Injectable()
export class WorkflowService implements IWorkflowService {
  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly workflowInstanceRepository: IWorkflowInstanceRepository,
    @Inject(WORKFLOW_DEFINITION_REPOSITORY)
    private readonly workflowDefinitionRepository: IWorkflowDefinitionRepository,
  ) {}

  async getWorkflowContext(
    entityType: string,
    entityId: string,
    organizationId: string,
  ): Promise<string | null> {
    try {
      // Find workflow instances for this entity
      const instances = await this.workflowInstanceRepository.findAll(
        organizationId,
        undefined,
        entityType,
        entityId,
      )

      if (!instances || instances.length === 0) {
        return null
      }

      const instance = instances[0]
      const wf = await this.workflowDefinitionRepository.findById(
        instance.workflowDefinitionId,
        organizationId,
      )

      if (!wf) {
        return null
      }

      const nextStates = (wf.transitions || [])
        .filter((t: any) => t.from === instance.currentState)
        .map((t: any) => t.to)

      const nextStr = nextStates.length ? nextStates.join(', ') : 'none'
      return `Current workflow state: ${instance.currentState}. Workflow: ${wf.name}. Possible next states: ${nextStr}.`
    } catch {
      return null
    }
  }
}
