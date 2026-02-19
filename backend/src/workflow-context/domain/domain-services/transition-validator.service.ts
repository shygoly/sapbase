import type { WorkflowTransitionVO } from '../value-objects'

/**
 * Result of expression guard evaluation (domain only; AI guards handled in application layer).
 */
export interface ExpressionGuardResult {
  passed: boolean
  error?: string
}

/**
 * Domain service: validates transitions and evaluates expression guards (pure, no I/O).
 */
export class TransitionValidator {
  /**
   * Evaluate an expression guard (no ai_guard; that is handled by application layer).
   */
  evaluateExpressionGuard(
    guardExpression: string,
    entity?: Record<string, unknown>,
    context?: Record<string, unknown>,
  ): ExpressionGuardResult {
    try {
      const safeEntity = entity ?? {}
      const safeContext = context ?? {}
      const evalContext = {
        entity: safeEntity,
        context: safeContext,
        has: (obj: unknown, prop: string) => typeof obj === 'object' && obj !== null && prop in obj,
        equals: (a: unknown, b: unknown) => a === b,
        notEquals: (a: unknown, b: unknown) => a !== b,
        greaterThan: (a: number, b: number) => a > b,
        lessThan: (a: number, b: number) => a < b,
        contains: (str: string, substr: string) => (str ?? '').includes(substr),
        isEmpty: (val: unknown) => {
          if (val === null || val === undefined) return true
          if (typeof val === 'string') return val.trim() === ''
          if (Array.isArray(val)) return val.length === 0
          if (typeof val === 'object') return Object.keys(val as object).length === 0
          return false
        },
        Math: { abs: Math.abs, max: Math.max, min: Math.min, round: Math.round },
      }
      const expression = guardExpression.trim()
      // eslint-disable-next-line no-eval
      const result = eval(
        `(function() {
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
        })`,
      )(evalContext)
      return { passed: Boolean(result) }
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : 'Guard evaluation failed',
      }
    }
  }

  /**
   * Check if a transition exists and, if it has an expression guard, evaluate it.
   * Returns null if transition not found; otherwise { valid, error?, guardResult? }.
   * AI guards are NOT evaluated here (application layer uses IAiGuardEvaluator).
   */
  validateTransition(
    transition: WorkflowTransitionVO | null,
    entity?: Record<string, unknown>,
    context?: Record<string, unknown>,
  ): { valid: boolean; error?: string; guardResult?: ExpressionGuardResult } {
    if (!transition) {
      return { valid: false, error: 'No transition found' }
    }
    if (!transition.guard) {
      return { valid: true }
    }
    if (transition.guard === 'ai_guard' || transition.guard.startsWith('ai_guard:')) {
      return { valid: true, guardResult: undefined }
    }
    const guardResult = this.evaluateExpressionGuard(
      transition.guard,
      entity,
      context,
    )
    if (!guardResult.passed) {
      return {
        valid: false,
        error: guardResult.error ?? 'Guard condition failed',
        guardResult,
      }
    }
    return { valid: true, guardResult }
  }
}
