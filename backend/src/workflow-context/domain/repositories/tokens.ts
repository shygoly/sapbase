/**
 * Injection tokens for repository and event ports (used by Nest DI).
 */
export const WORKFLOW_DEFINITION_REPOSITORY = Symbol(
  'IWorkflowDefinitionRepository',
)
export const WORKFLOW_INSTANCE_REPOSITORY = Symbol(
  'IWorkflowInstanceRepository',
)
export const WORKFLOW_HISTORY_REPOSITORY = Symbol('IWorkflowHistoryRepository')
export const EVENT_PUBLISHER = Symbol('IEventPublisher')
