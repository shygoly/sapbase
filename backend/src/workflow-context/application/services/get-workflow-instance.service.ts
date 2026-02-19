import { Inject, Injectable } from '@nestjs/common'
import type { WorkflowInstance, WorkflowDefinition } from '../../domain/entities'
import type { IWorkflowInstanceRepository } from '../../domain/repositories'
import type { IWorkflowDefinitionRepository } from '../../domain/repositories'
import {
  WORKFLOW_INSTANCE_REPOSITORY,
  WORKFLOW_DEFINITION_REPOSITORY,
} from '../../domain/repositories'

export interface WorkflowInstanceView {
  instance: WorkflowInstance
  workflowDefinition: WorkflowDefinition | null
}

@Injectable()
export class GetWorkflowInstanceService {
  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly workflowInstanceRepository: IWorkflowInstanceRepository,
    @Inject(WORKFLOW_DEFINITION_REPOSITORY)
    private readonly workflowDefinitionRepository: IWorkflowDefinitionRepository,
  ) {}

  async get(
    instanceId: string,
    organizationId: string,
  ): Promise<WorkflowInstanceView> {
    const instance =
      await this.workflowInstanceRepository.findById(instanceId, organizationId)
    if (!instance) {
      throw new Error(`Workflow instance with ID ${instanceId} not found`)
    }
    const workflowDefinition =
      await this.workflowDefinitionRepository.findById(
        instance.workflowDefinitionId,
        organizationId,
      )
    return { instance, workflowDefinition }
  }
}
