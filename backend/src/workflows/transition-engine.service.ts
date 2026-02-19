import { Injectable, BadRequestException } from '@nestjs/common'
import { WorkflowDefinition, WorkflowTransition } from './workflow-definition.entity'
import { WorkflowInstance } from './workflow-instance.entity'
import { WorkflowHistoryService } from './workflow-history.service'
import { WorkflowGuardAiService } from './workflow-guard-ai.service'

@Injectable()
export class TransitionEngineService {
  constructor(
    private workflowHistoryService: WorkflowHistoryService,
    private workflowGuardAiService: WorkflowGuardAiService,
  ) {}

  /**
   * Validate if a transition is allowed (sync for expression guards; async when AI guard is used).
   */
  async validateTransition(
    workflow: WorkflowDefinition,
    instance: WorkflowInstance,
    toState: string,
    entity?: Record<string, any>,
  ): Promise<{ valid: boolean; error?: string; guardResult?: any }> {
    const transition = workflow.transitions.find(
      (t) => t.from === instance.currentState && t.to === toState,
    )

    if (!transition) {
      return {
        valid: false,
        error: `No transition exists from "${instance.currentState}" to "${toState}"`,
      }
    }

    if (!transition.guard) {
      return { valid: true }
    }

    // AI guard: call LLM to decide
    if (transition.guard === 'ai_guard' || transition.guard.startsWith('ai_guard:')) {
      const aiResult = await this.workflowGuardAiService.evaluateGuard(
        entity,
        instance,
        transition,
        toState,
      )
      const guardResult = {
        passed: aiResult.allowed,
        type: 'ai_guard',
        reason: aiResult.reason,
        model: aiResult.model,
        error: aiResult.error,
      }
      if (!aiResult.allowed) {
        return {
          valid: false,
          error: aiResult.reason || 'AI guard rejected transition',
          guardResult,
        }
      }
      return { valid: true, guardResult }
    }

    // Expression guard
    const guardResult = this.evaluateGuard(transition.guard, entity, instance.context)
    if (!guardResult.passed) {
      return {
        valid: false,
        error: guardResult.error || 'Guard condition failed',
        guardResult,
      }
    }
    return { valid: true, guardResult }
  }

  /**
   * Execute a state transition
   */
  async executeTransition(
    workflow: WorkflowDefinition,
    instance: WorkflowInstance,
    toState: string,
    userId: string,
    entity?: Record<string, any>,
    entityService?: {
      update: (id: string, updates: Record<string, any>, organizationId: string) => Promise<any>
    },
  ): Promise<{ success: boolean; error?: string; historyId?: string; updatedEntity?: any }> {
    const validation = await this.validateTransition(workflow, instance, toState, entity)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const fromState = instance.currentState

    try {
      // Execute action if present
      const transition = workflow.transitions.find(
        (t) => t.from === fromState && t.to === toState,
      )
      let actionResult: { executed: boolean; action?: string; error?: string } | undefined = undefined

      if (transition?.action) {
        const result = await this.executeAction(transition.action, entity, instance.context)
        actionResult = {
          executed: result.executed,
          action: transition.action,
          error: result.error,
        }
      }

      // Update entity state field if entityService is provided (registry-resolved or passed in)
      let updatedEntity = null
      if (entityService && instance.entityId) {
        const stateField = (entity
          ? (this.determineStateFieldName(entity) ?? 'state')
          : 'state')
        try {
          updatedEntity = await entityService.update(
            instance.entityId,
            { [stateField]: toState },
            instance.organizationId,
          )
        } catch (error) {
          // Log but don't fail transition if entity update fails
          console.warn(`Failed to update entity state field: ${error}`)
        }
      }

      // Record history
      const history = await this.workflowHistoryService.create({
        workflowInstanceId: instance.id,
        fromState,
        toState,
        triggeredById: userId,
        guardResult: validation.guardResult,
        actionResult,
      })

      return { success: true, historyId: history.id, updatedEntity }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transition execution failed',
      }
    }
  }

  /**
   * Determine the state field name from entity structure
   */
  private determineStateFieldName(entity: Record<string, any>): string | null {
    // Common state field names
    const stateFields = ['state', 'status', 'workflowState', 'currentState', 'stage']
    
    for (const field of stateFields) {
      if (field in entity) {
        return field
      }
    }
    
    // Default to 'state' if no common field found
    return 'state'
  }

  /**
   * Get available transitions from current state
   */
  getAvailableTransitions(
    workflow: WorkflowDefinition,
    instance: WorkflowInstance,
    entity?: Record<string, any>,
  ): Array<{ transition: WorkflowTransition; guardPassed: boolean; guardError?: string }> {
    const transitions = workflow.transitions.filter((t) => t.from === instance.currentState)

    return transitions.map((transition) => {
      if (!transition.guard) {
        return { transition, guardPassed: true }
      }

      const guardResult = this.evaluateGuard(transition.guard, entity, instance.context)
      return {
        transition,
        guardPassed: guardResult.passed,
        guardError: guardResult.error,
      }
    })
  }

  /**
   * Evaluate guard condition with improved parser
   * Supports: property access, comparisons, logical operators, basic functions
   * Note: In production, use a sandboxed JavaScript evaluator (vm2, isolated-vm)
   */
  private evaluateGuard(
    guardExpression: string,
    entity?: Record<string, any>,
    context?: Record<string, any>,
  ): { passed: boolean; error?: string } {
    try {
      const safeEntity = entity || {}
      const safeContext = context || {}

      // Create a safe evaluation context
      const evalContext = {
        entity: safeEntity,
        context: safeContext,
        // Helper functions
        has: (obj: any, prop: string) => prop in (obj || {}),
        equals: (a: any, b: any) => a === b,
        notEquals: (a: any, b: any) => a !== b,
        greaterThan: (a: number, b: number) => a > b,
        lessThan: (a: number, b: number) => a < b,
        contains: (str: string, substr: string) => (str || '').includes(substr),
        isEmpty: (val: any) => {
          if (val === null || val === undefined) return true
          if (typeof val === 'string') return val.trim() === ''
          if (Array.isArray(val)) return val.length === 0
          if (typeof val === 'object') return Object.keys(val).length === 0
          return false
        },
        // Math functions
        Math: {
          abs: Math.abs,
          max: Math.max,
          min: Math.min,
          round: Math.round,
        },
      }

      // Wrap expression in a function for safer evaluation
      // Replace common patterns for better safety
      let expression = guardExpression.trim()

      // Support common patterns:
      // - entity.field === value
      // - entity.field > value
      // - context.variable === value
      // - has(entity, 'field')
      // - isEmpty(entity.field)

      // Evaluate in a controlled context
      // eslint-disable-next-line no-eval
      const result = eval(`(function() {
        const entity = arguments[0].entity;
        const context = arguments[0].context;
        const has = arguments[0].has;
        const equals = arguments[0].equals;
        const notEquals = arguments[0].notEquals;
        const greaterThan = arguments[0].greaterThan;
        const lessThan = arguments[0].lessThan;
        const contains = arguments[0].contains;
        const isEmpty = arguments[0].isEmpty;
        const Math = arguments[0].Math;
        return ${expression};
      })`)(evalContext)

      return { passed: Boolean(result) }
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : 'Guard evaluation failed',
      }
    }
  }

  /**
   * Execute action hook
   * Supports predefined actions: notify, updateFields, triggerWebhook
   */
  private async executeAction(
    action: string,
    entity?: Record<string, any>,
    context?: Record<string, any>,
  ): Promise<{ executed: boolean; error?: string }> {
    try {
      // Parse action (format: "actionName:param1:param2" or JSON)
      let actionName = action
      let actionParams: Record<string, any> = {}

      if (action.includes(':')) {
        const parts = action.split(':')
        actionName = parts[0]
        // Try to parse remaining parts as JSON
        if (parts.length > 1) {
          try {
            actionParams = JSON.parse(parts.slice(1).join(':'))
          } catch {
            // If not JSON, treat as simple key-value pairs
            actionParams = { value: parts.slice(1).join(':') }
          }
        }
      } else if (action.startsWith('{')) {
        // Action is JSON
        const parsed = JSON.parse(action)
        actionName = parsed.action || parsed.name || 'unknown'
        actionParams = parsed.params || parsed
      }

      // Execute predefined actions
      switch (actionName.toLowerCase()) {
        case 'notify':
          // Placeholder for notification action
          // In production, integrate with notification service
          console.log(`[Action: Notify] ${actionParams.message || 'Workflow transition occurred'}`)
          return { executed: true }

        case 'updatefields':
        case 'update_fields':
          // Update entity fields (would need entity service)
          console.log(`[Action: UpdateFields] Fields: ${JSON.stringify(actionParams.fields || {})}`)
          return { executed: true }

        case 'triggerwebhook':
        case 'trigger_webhook':
          // Placeholder for webhook trigger
          // In production, make HTTP request to webhook URL
          console.log(`[Action: TriggerWebhook] URL: ${actionParams.url || 'not specified'}`)
          return { executed: true }

        case 'log':
          // Log action
          console.log(`[Action: Log] ${actionParams.message || JSON.stringify(actionParams)}`)
          return { executed: true }

        default:
          // Unknown action - log and continue
          console.warn(`[Action: Unknown] ${actionName}`)
          return { executed: false, error: `Unknown action: ${actionName}` }
      }
    } catch (error) {
      return {
        executed: false,
        error: error instanceof Error ? error.message : 'Action execution failed',
      }
    }
  }
}
