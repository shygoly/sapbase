import { httpClient } from './client'

export interface WorkflowState {
  name: string
  initial?: boolean
  final?: boolean
  metadata?: Record<string, any>
}

export interface WorkflowTransition {
  from: string
  to: string
  guard?: string
  action?: string
  metadata?: Record<string, any>
}

export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  entityType: string
  states: WorkflowState[]
  transitions: WorkflowTransition[]
  status: 'active' | 'inactive' | 'draft'
  version: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface WorkflowInstance {
  id: string
  workflowDefinitionId: string
  entityType: string
  entityId: string
  currentState: string
  context?: Record<string, any>
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedById?: string
  startedAt: string
  completedAt?: string
  availableTransitions?: Array<{
    transition: WorkflowTransition
    guardPassed: boolean
    guardError?: string
  }>
}

export interface WorkflowHistory {
  id: string
  workflowInstanceId: string
  fromState?: string
  toState: string
  triggeredById?: string
  timestamp: string
  guardResult?: {
    passed: boolean
    expression?: string
    error?: string
  }
  actionResult?: {
    executed: boolean
    action?: string
    error?: string
  }
  metadata?: Record<string, any>
}

export interface CreateWorkflowDefinitionDto {
  name: string
  description?: string
  entityType: string
  states: WorkflowState[]
  transitions: WorkflowTransition[]
  metadata?: Record<string, any>
}

export interface UpdateWorkflowDefinitionDto {
  name?: string
  description?: string
  states?: WorkflowState[]
  transitions?: WorkflowTransition[]
  status?: 'active' | 'inactive' | 'draft'
  metadata?: Record<string, any>
}

export interface CreateWorkflowInstanceDto {
  workflowDefinitionId: string
  entityType: string
  entityId: string
  context?: Record<string, any>
}

export interface TransitionDto {
  toState: string
  entity?: Record<string, any>
  entityService?: string
}

export interface SuggestedTransition {
  toState: string
  reason: string
}

/** Unwrap backend response (may be { code, message, data } or direct data). */
function unwrap<T>(response: { data: T | { data?: T } }): T {
  const body = response.data
  if (body != null && typeof body === 'object' && 'data' in body && (body as { data?: T }).data !== undefined) {
    return (body as { data: T }).data
  }
  return body as T
}

class WorkflowsApi {
  // Workflow Definitions

  async createWorkflow(dto: CreateWorkflowDefinitionDto): Promise<WorkflowDefinition> {
    const response = await httpClient.post<any>('/api/workflows', dto)
    return unwrap(response)
  }

  async getWorkflows(entityType?: string): Promise<WorkflowDefinition[]> {
    const params = entityType ? { entityType } : {}
    const response = await httpClient.get<any>('/api/workflows', { params })
    return unwrap(response) ?? []
  }

  async getWorkflow(id: string): Promise<WorkflowDefinition> {
    const response = await httpClient.get<any>(`/api/workflows/${id}`)
    return unwrap(response)
  }

  async updateWorkflow(id: string, dto: UpdateWorkflowDefinitionDto): Promise<WorkflowDefinition> {
    const response = await httpClient.patch<any>(`/api/workflows/${id}`, dto)
    return unwrap(response)
  }

  async deleteWorkflow(id: string): Promise<void> {
    await httpClient.delete(`/api/workflows/${id}`)
  }

  // Workflow Instances

  async startWorkflow(
    workflowDefinitionId: string,
    dto: Omit<CreateWorkflowInstanceDto, 'workflowDefinitionId'>,
  ): Promise<WorkflowInstance> {
    const response = await httpClient.post<any>(
      `/api/workflows/${workflowDefinitionId}/start`,
      dto,
    )
    return unwrap(response)
  }

  async getInstances(
    workflowDefinitionId?: string,
    entityType?: string,
    entityId?: string,
  ): Promise<WorkflowInstance[]> {
    const params: Record<string, string> = {}
    if (workflowDefinitionId) params.workflowDefinitionId = workflowDefinitionId
    if (entityType) params.entityType = entityType
    if (entityId) params.entityId = entityId
    const response = await httpClient.get<any>('/api/workflow-instances', { params })
    return unwrap(response) ?? []
  }

  async getInstance(id: string): Promise<WorkflowInstance> {
    const response = await httpClient.get<any>(`/api/workflow-instances/${id}`)
    return unwrap(response)
  }

  async executeTransition(id: string, dto: TransitionDto): Promise<WorkflowInstance> {
    const response = await httpClient.post<any>(
      `/api/workflow-instances/${id}/transition`,
      dto,
    )
    return unwrap(response)
  }

  async cancelInstance(id: string): Promise<WorkflowInstance> {
    const response = await httpClient.post<any>(
      `/api/workflow-instances/${id}/cancel`,
      {},
    )
    return unwrap(response)
  }

  async getHistory(instanceId: string): Promise<WorkflowHistory[]> {
    const response = await httpClient.get<any>(
      `/api/workflow-instances/${instanceId}/history`,
    )
    return unwrap(response) ?? []
  }

  async getSuggestedTransitions(
    instanceId: string,
    entitySnapshot?: Record<string, any>,
  ): Promise<SuggestedTransition[]> {
    const params =
      entitySnapshot != null ? { entity: JSON.stringify(entitySnapshot) } : {}
    const response = await httpClient.get<any>(
      `/api/workflow-instances/${instanceId}/suggested-transitions`,
      { params, timeout: 12000 },
    )
    return unwrap(response) ?? []
  }
}

export const workflowsApi = new WorkflowsApi()
