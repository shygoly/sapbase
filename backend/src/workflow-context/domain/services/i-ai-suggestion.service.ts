/**
 * Port for AI-suggested transitions (implemented in infrastructure).
 */
export interface SuggestedTransition {
  toState: string
  reason: string
}

export interface IAiSuggestionService {
  getSuggestedTransitions(
    instanceId: string,
    organizationId: string,
    context: { currentState: string; entityType: string; toStates: string[] },
    entitySnapshot?: Record<string, unknown>,
  ): Promise<SuggestedTransition[]>
}
