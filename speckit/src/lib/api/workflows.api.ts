import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

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

class WorkflowsApi {
  private getHeaders() {
    const token = localStorage.getItem('token')
    const organizationId = localStorage.getItem('currentOrganizationId')
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      'X-Organization-Id': organizationId || '',
    }
  }

  // Workflow Definitions

  async createWorkflow(dto: CreateWorkflowDefinitionDto): Promise<WorkflowDefinition> {
    const response = await axios.post(`${API_BASE_URL}/workflows`, dto, {
      headers: this.getHeaders(),
    })
    return response.data
  }

  async getWorkflows(entityType?: string): Promise<WorkflowDefinition[]> {
    const params = entityType ? { entityType } : {}
    const response = await axios.get(`${API_BASE_URL}/workflows`, {
      headers: this.getHeaders(),
      params,
    })
    return response.data
  }

  async getWorkflow(id: string): Promise<WorkflowDefinition> {
    const response = await axios.get(`${API_BASE_URL}/workflows/${id}`, {
      headers: this.getHeaders(),
    })
    return response.data
  }

  async updateWorkflow(id: string, dto: UpdateWorkflowDefinitionDto): Promise<WorkflowDefinition> {
    const response = await axios.patch(`${API_BASE_URL}/workflows/${id}`, dto, {
      headers: this.getHeaders(),
    })
    return response.data
  }

  async deleteWorkflow(id: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/workflows/${id}`, {
      headers: this.getHeaders(),
    })
  }

  // Workflow Instances

  async startWorkflow(
    workflowDefinitionId: string,
    dto: Omit<CreateWorkflowInstanceDto, 'workflowDefinitionId'>,
  ): Promise<WorkflowInstance> {
    const response = await axios.post(
      `${API_BASE_URL}/workflows/${workflowDefinitionId}/start`,
      dto,
      {
        headers: this.getHeaders(),
      },
    )
    return response.data
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

    const response = await axios.get(`${API_BASE_URL}/workflow-instances`, {
      headers: this.getHeaders(),
      params,
    })
    return response.data
  }

  async getInstance(id: string): Promise<WorkflowInstance> {
    const response = await axios.get(`${API_BASE_URL}/workflow-instances/${id}`, {
      headers: this.getHeaders(),
    })
    return response.data
  }

  async executeTransition(id: string, dto: TransitionDto): Promise<WorkflowInstance> {
    const response = await axios.post(
      `${API_BASE_URL}/workflow-instances/${id}/transition`,
      dto,
      {
        headers: this.getHeaders(),
      },
    )
    return response.data
  }

  async cancelInstance(id: string): Promise<WorkflowInstance> {
    const response = await axios.post(
      `${API_BASE_URL}/workflow-instances/${id}/cancel`,
      {},
      {
        headers: this.getHeaders(),
      },
    )
    return response.data
  }

  async getHistory(instanceId: string): Promise<WorkflowHistory[]> {
    const response = await axios.get(
      `${API_BASE_URL}/workflow-instances/${instanceId}/history`,
      {
        headers: this.getHeaders(),
      },
    )
    return response.data
  }
}

export const workflowsApi = new WorkflowsApi()
