import { Inject, Injectable } from '@nestjs/common'
import { TransitionValidator } from '../../domain/domain-services'
import type { IWorkflowInstanceRepository } from '../../domain/repositories'
import type { IWorkflowDefinitionRepository } from '../../domain/repositories'
import {
  WORKFLOW_INSTANCE_REPOSITORY,
  WORKFLOW_DEFINITION_REPOSITORY,
} from '../../domain/repositories'

export interface AvailableTransition {
  transition: {
    from: string
    to: string
    guard?: string
    action?: string
  }
  guardPassed: boolean
  guardError?: string
}

@Injectable()
export class GetAvailableTransitionsService {
  private readonly transitionValidator = new TransitionValidator()

  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly workflowInstanceRepository: IWorkflowInstanceRepository,
    @Inject(WORKFLOW_DEFINITION_REPOSITORY)
    private readonly workflowDefinitionRepository: IWorkflowDefinitionRepository,
  ) {}

  async getAvailableTransitions(
    instanceId: string,
    organizationId: string,
    entity?: Record<string, unknown>,
  ): Promise<AvailableTransition[]> {
    const instance = await this.workflowInstanceRepository.findById(
      instanceId,
      organizationId,
    )
    if (!instance) {
      return []
    }

    const workflow = await this.workflowDefinitionRepository.findById(
      instance.workflowDefinitionId,
      organizationId,
    )
    if (!workflow) {
      return []
    }

    const transitions = workflow.transitions.filter(
      (t) => t.from === instance.currentState,
    )

    return transitions.map((transition) => {
      if (!transition.guard) {
        return {
          transition: {
            from: transition.from,
            to: transition.to,
            guard: transition.guard,
            action: transition.action,
          },
          guardPassed: true,
        }
      }

      if (
        transition.guard === 'ai_guard' ||
        transition.guard.startsWith('ai_guard:')
      ) {
        return {
          transition: {
            from: transition.from,
            to: transition.to,
            guard: transition.guard,
            action: transition.action,
          },
          guardPassed: true,
        }
      }

      const guardResult = this.transitionValidator.evaluateExpressionGuard(
        transition.guard,
        entity,
        instance.context,
      )
      return {
        transition: {
          from: transition.from,
          to: transition.to,
          guard: transition.guard,
          action: transition.action,
        },
        guardPassed: guardResult.passed,
        guardError: guardResult.error,
      }
    })
  }
}
