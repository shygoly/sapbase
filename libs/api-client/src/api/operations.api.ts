import { httpClient } from './client'

export interface OperationsDashboardWindow {
  from: string
  to: string
  hours: number
}

export interface OperationsAuditPanel {
  total: number
  byAction: Array<{ action: string; count: number }>
  recent: Array<{
    id: string
    action: string
    resource: string
    status: string
    actor: string
    timestamp: string
  }>
}

export interface OperationsSloPanel {
  agent: { total: number; successRate: number; p95LatencyMs: number }
  tools: { total: number; successRate: number; p95LatencyMs: number }
  installations: { total: number; availability: number }
  targets: {
    agentSuccessRate: number
    toolSuccessRate: number
    agentP95LatencyMs: number
    toolP95LatencyMs: number
    installationAvailability: number
  }
  met: {
    agentSuccessRate: boolean
    toolSuccessRate: boolean
    agentP95LatencyMs: boolean
    toolP95LatencyMs: boolean
    installationAvailability: boolean
  }
}

export interface OperationsCostPanel {
  tokensIn: number
  tokensOut: number
  estimatedCostUsd: number
  byModel: Array<{
    modelId: string
    tokensIn: number
    tokensOut: number
    estimatedCostUsd: number
  }>
  usage: Array<{ metric: string; quantity: number }>
}

export interface OperationsFailurePanel {
  agentTurns: number
  toolCalls: number
  installations: number
  recent: Array<{
    kind: 'agent_turn' | 'tool_call' | 'installation'
    id: string
    status: string
    detail: string | null
    createdAt: string
  }>
}

export interface OperationsDashboard {
  generatedAt: string
  window: OperationsDashboardWindow
  audit: OperationsAuditPanel
  slo: OperationsSloPanel
  cost: OperationsCostPanel
  failures: OperationsFailurePanel
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const operationsApi = {
  async dashboard(hours = 24): Promise<OperationsDashboard> {
    return unwrap<OperationsDashboard>(
      await httpClient.get('/api/operations/dashboard', { params: { hours } }),
    )
  },
}
