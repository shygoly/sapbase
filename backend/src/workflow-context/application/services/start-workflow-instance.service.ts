import { Inject, Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { BusinessRuleViolation } from '../../domain/errors'
import { WorkflowInstance } from '../../domain/entities'
import type { IWorkflowDefinitionRepository } from '../../domain/repositories'
import type { IWorkflowInstanceRepository } from '../../domain/repositories'
import {
  WORKFLOW_DEFINITION_REPOSITORY,
  WORKFLOW_INSTANCE_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { WorkflowInstanceStartedEvent } from '../../domain/events'

export interface StartWorkflowInstanceCommand {
  workflowDefinitionId: string
  entityType: string
  entityId: string
  context?: Record<string, unknown>
  organizationId: string
  userId: string
}

@Injectable()
export class StartWorkflowInstanceService {
  constructor(
    @Inject(WORKFLOW_DEFINITION_REPOSITORY)
    private readonly workflowDefinitionRepository: IWorkflowDefinitionRepository,
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly workflowInstanceRepository: IWorkflowInstanceRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: StartWorkflowInstanceCommand): Promise<WorkflowInstance> {
    const workflow = await this.workflowDefinitionRepository.findById(
      command.workflowDefinitionId,
      command.organizationId,
    )
    if (!workflow) {
      throw new BusinessRuleViolation('Workflow definition not found')
    }
    workflow.ensureCanStart()

    const existing =
      await this.workflowInstanceRepository.findRunningInstance(
        command.entityType,
        command.entityId,
        command.workflowDefinitionId,
        command.organizationId,
      )
    if (existing) {
      throw new BusinessRuleViolation(
        'Workflow instance already exists for this entity',
      )
    }

    const instanceId = uuidv4()
    const instance = WorkflowInstance.create(
      instanceId,
      command.organizationId,
      workflow,
      command.entityType,
      command.entityId,
      command.userId,
      command.context,
    )
    await this.workflowInstanceRepository.save(instance)
    await this.eventPublisher.publish(
      new WorkflowInstanceStartedEvent(
        instance.id,
        workflow.id,
        command.entityType,
        command.entityId,
      ),
    )
    return instance
  }
}
