import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import type { IWorkflowInstanceRepository } from '../../domain/repositories'
import { WORKFLOW_INSTANCE_REPOSITORY } from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { EVENT_PUBLISHER } from '../../domain/repositories'
import { WorkflowInstanceCancelledEvent } from '../../domain/events'

@Injectable()
export class CancelWorkflowInstanceService {
  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly workflowInstanceRepository: IWorkflowInstanceRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async cancel(
    instanceId: string,
    organizationId: string,
  ): Promise<{ id: string; status: string; cancelledAt: Date }> {
    const instance = await this.workflowInstanceRepository.findById(
      instanceId,
      organizationId,
    )
    if (!instance) {
      throw new BusinessRuleViolation('Workflow instance not found')
    }

    if (instance.status !== 'running') {
      throw new BusinessRuleViolation(
        `Cannot cancel workflow instance in status: ${instance.status}`,
      )
    }

    instance.cancel()
    await this.workflowInstanceRepository.save(instance)

    await this.eventPublisher.publish(
      new WorkflowInstanceCancelledEvent(instance.id, new Date()),
    )

    return {
      id: instance.id,
      status: instance.status,
      cancelledAt: instance.completedAt ?? new Date(),
    }
  }
}
