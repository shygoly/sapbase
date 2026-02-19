/**
 * Port for AI guard evaluation (implemented in infrastructure).
 */
export interface AiGuardResult {
  allowed: boolean
  reason?: string
  model?: string
  error?: string
}

export interface IAiGuardEvaluator {
  evaluateGuard(
    entity: Record<string, unknown> | undefined,
    instance: { currentState: string; context?: Record<string, unknown> },
    transition: { from: string; to: string; guard?: string },
    toState: string,
  ): Promise<AiGuardResult>
}
