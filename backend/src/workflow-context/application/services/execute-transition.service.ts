import { Inject, Injectable } from '@nestjs/common'
import { BusinessRuleViolation } from '../../domain/errors'
import { TransitionValidator } from '../../domain/domain-services'
import type { WorkflowDefinition, WorkflowInstance } from '../../domain/entities'
import type { IWorkflowDefinitionRepository } from '../../domain/repositories'
import type { IWorkflowInstanceRepository } from '../../domain/repositories'
import type { IWorkflowHistoryRepository } from '../../domain/repositories'
import {
  WORKFLOW_DEFINITION_REPOSITORY,
  WORKFLOW_INSTANCE_REPOSITORY,
  WORKFLOW_HISTORY_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type { IAiGuardEvaluator } from '../../domain/services'
import { AI_GUARD_EVALUATOR } from '../../domain/services'
import type { IEventPublisher } from '../../domain/events'
import {
  WorkflowTransitionedEvent,
  WorkflowInstanceCompletedEvent,
} from '../../domain/events'

export interface ExecuteTransitionCommand {
  instanceId: string
  toState: string
  userId: string
  organizationId: string
  entity?: Record<string, unknown>
  entityUpdater?: {
    update: (
      id: string,
      updates: Record<string, unknown>,
      organizationId: string,
    ) => Promise<unknown>
  }
}

export interface ExecuteTransitionResult {
  success: boolean
  error?: string
  historyId?: string
  updatedEntity?: unknown
}

@Injectable()
export class ExecuteTransitionService {
  private readonly transitionValidator = new TransitionValidator()

  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly workflowInstanceRepository: IWorkflowInstanceRepository,
    @Inject(WORKFLOW_DEFINITION_REPOSITORY)
    private readonly workflowDefinitionRepository: IWorkflowDefinitionRepository,
    @Inject(WORKFLOW_HISTORY_REPOSITORY)
    private readonly workflowHistoryRepository: IWorkflowHistoryRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
    @Inject(AI_GUARD_EVALUATOR)
    private readonly aiGuardEvaluator: IAiGuardEvaluator,
  ) {}

  async execute(
    command: ExecuteTransitionCommand,
  ): Promise<ExecuteTransitionResult> {
    const instance = await this.workflowInstanceRepository.findById(
      command.instanceId,
      command.organizationId,
    )
    if (!instance) {
      return { success: false, error: 'Workflow instance not found' }
    }

    const workflow = await this.workflowDefinitionRepository.findById(
      instance.workflowDefinitionId,
      command.organizationId,
    )
    if (!workflow) {
      return { success: false, error: 'Workflow definition not found' }
    }

    const transition = workflow.findTransition(
      instance.currentState,
      command.toState,
    )
    if (!transition) {
      return {
        success: false,
        error: `No transition exists from "${instance.currentState}" to "${command.toState}"`,
      }
    }

    let guardResult: { passed: boolean; error?: string; type?: string; reason?: string; model?: string } | undefined

    if (transition.guard) {
      if (
        transition.guard === 'ai_guard' ||
        transition.guard.startsWith('ai_guard:')
      ) {
        const aiResult = await this.aiGuardEvaluator.evaluateGuard(
          command.entity,
          {
            currentState: instance.currentState,
            context: instance.context,
          },
          transition,
          command.toState,
        )
        guardResult = {
          passed: aiResult.allowed,
          type: 'ai_guard',
          reason: aiResult.reason,
          model: aiResult.model,
          error: aiResult.error,
        }
        if (!aiResult.allowed) {
          return {
            success: false,
            error: aiResult.reason || 'AI guard rejected transition',
          }
        }
      } else {
        const exprResult = this.transitionValidator.validateTransition(
          transition,
          command.entity,
          instance.context,
        )
        if (!exprResult.valid) {
          return {
            success: false,
            error: exprResult.error || 'Guard condition failed',
          }
        }
        guardResult = exprResult.guardResult
          ? {
              passed: exprResult.guardResult.passed,
              error: exprResult.guardResult.error,
            }
          : undefined
      }
    }

    const fromState = instance.currentState

    let actionResult:
      | { executed: boolean; action?: string; error?: string }
      | undefined = undefined

    if (transition.action) {
      actionResult = await this.executeAction(
        transition.action,
        command.entity,
        instance.context,
      )
    }

    let updatedEntity: unknown = null
    if (command.entityUpdater && instance.entityId) {
      const stateField = this.determineStateFieldName(command.entity)
      try {
        updatedEntity = await command.entityUpdater.update(
          instance.entityId,
          { [stateField]: command.toState },
          command.organizationId,
        )
      } catch (error) {
        console.warn(`Failed to update entity state field: ${error}`)
      }
    }

    instance.transitionTo(command.toState, workflow)
    await this.workflowInstanceRepository.save(instance)

    const history = await this.workflowHistoryRepository.create({
      workflowInstanceId: instance.id,
      fromState,
      toState: command.toState,
      triggeredById: command.userId,
      guardResult: guardResult as any,
      actionResult: actionResult as any,
    })

    await this.eventPublisher.publish(
      new WorkflowTransitionedEvent(
        instance.id,
        fromState,
        command.toState,
        command.userId,
        new Date(),
      ),
    )

    if (workflow.isFinalState(command.toState)) {
      await this.eventPublisher.publish(
        new WorkflowInstanceCompletedEvent(
          instance.id,
          command.toState,
          instance.completedAt ?? new Date(),
        ),
      )
    }

    return {
      success: true,
      historyId: history.id,
      updatedEntity,
    }
  }

  private determineStateFieldName(entity?: Record<string, unknown>): string {
    if (!entity) return 'state'
    const stateFields = ['state', 'status', 'workflowState', 'currentState', 'stage']
    for (const field of stateFields) {
      if (field in entity) {
        return field
      }
    }
    return 'state'
  }

  private async executeAction(
    action: string,
    entity?: Record<string, unknown>,
    context?: Record<string, unknown>,
  ): Promise<{ executed: boolean; action?: string; error?: string }> {
    try {
      let actionName = action
      let actionParams: Record<string, unknown> = {}

      if (action.includes(':')) {
        const parts = action.split(':')
        actionName = parts[0]
        if (parts.length > 1) {
          try {
            actionParams = JSON.parse(parts.slice(1).join(':'))
          } catch {
            actionParams = { value: parts.slice(1).join(':') }
          }
        }
      } else if (action.startsWith('{')) {
        const parsed = JSON.parse(action)
        actionName = (parsed.action || parsed.name || 'unknown') as string
        actionParams = parsed.params || parsed
      }

      switch (actionName.toLowerCase()) {
        case 'notify':
          console.log(
            `[Action: Notify] ${actionParams.message || 'Workflow transition occurred'}`,
          )
          return { executed: true, action }
        case 'updatefields':
        case 'update_fields':
          console.log(
            `[Action: UpdateFields] Fields: ${JSON.stringify(actionParams.fields || {})}`,
          )
          return { executed: true, action }
        case 'triggerwebhook':
        case 'trigger_webhook':
          console.log(
            `[Action: TriggerWebhook] URL: ${actionParams.url || 'not specified'}`,
          )
          return { executed: true, action }
        case 'log':
          console.log(
            `[Action: Log] ${actionParams.message || JSON.stringify(actionParams)}`,
          )
          return { executed: true, action }
        default:
          console.warn(`[Action: Unknown] ${actionName}`)
          return { executed: false, action, error: `Unknown action: ${actionName}` }
      }
    } catch (error) {
      return {
        executed: false,
        action,
        error: error instanceof Error ? error.message : 'Action execution failed',
      }
    }
  }
}
