import { httpClient } from './client'

export interface LabSample {
  id: string
  sampleCode: string
  sampleType?: string | null
  quantity: number
  status: string
  assignedAnalystId?: string | null
  assignedMethodId?: string | null
  createdAt: string
}

export interface LabMethod {
  id: string
  methodCode: string
  methodName: string
  status: string
  currentVersion: number
  createdAt: string
}

export interface LabWorkflowExecution {
  id: string
  sampleId: string
  methodId: string
  currentStep: number
  plannedSteps: number
  status: string
  assignedAnalystId?: string | null
  createdAt: string
}

export interface LabQaSubmission {
  id: string
  sampleId: string
  methodId: string
  workflowExecutionId: string
  status: string
  submittedAt: string
}

export interface LabReport {
  id: string
  title: string
  status: string
  format: string
  language: string
  createdAt: string
}

export interface LabAuditLog {
  id: string
  eventAt: string
  actorId?: string | null
  action: string
  entityType: string
  entityId: string
  message?: string | null
}

function unwrap<T>(response: { data: T | { data?: T } }): T {
  const body = response.data
  if (body != null && typeof body === 'object' && 'data' in body && (body as { data?: T }).data !== undefined) {
    return (body as { data: T }).data
  }
  return body as T
}

class LabApi {
  async listSamples(): Promise<LabSample[]> {
    const response = await httpClient.get<any>('/api/samples')
    return unwrap(response) ?? []
  }

  async listMethods(): Promise<LabMethod[]> {
    const response = await httpClient.get<any>('/api/methods')
    return unwrap(response) ?? []
  }

  async listAnalystWorkQueue(): Promise<LabWorkflowExecution[]> {
    const response = await httpClient.get<any>('/api/analyst/work-queue')
    return unwrap(response) ?? []
  }

  async listQaReviewQueue(): Promise<LabQaSubmission[]> {
    const response = await httpClient.get<any>('/api/qa/review-queue')
    return unwrap(response) ?? []
  }

  async listReports(): Promise<LabReport[]> {
    const response = await httpClient.get<any>('/api/reports')
    return unwrap(response) ?? []
  }

  async getReport(id: string): Promise<LabReport> {
    const response = await httpClient.get<any>(`/api/reports/${id}`)
    return unwrap(response)
  }

  async generateReport(id: string, payload?: { format?: string; language?: string }): Promise<LabReport> {
    const response = await httpClient.post<any>(`/api/reports/${id}/generate`, payload ?? {})
    return unwrap(response)
  }

  async finalizeReport(id: string): Promise<LabReport> {
    const response = await httpClient.post<any>(`/api/reports/${id}/finalize`, {})
    return unwrap(response)
  }

  async listAuditLogs(filters?: {
    action?: string
    entityType?: string
    entityId?: string
    from?: string
    to?: string
  }): Promise<LabAuditLog[]> {
    const response = await httpClient.get<any>('/api/audit/logs', { params: filters ?? {} })
    return unwrap(response) ?? []
  }

  async exportAuditLogs(filters?: {
    action?: string
    entityType?: string
    entityId?: string
    from?: string
    to?: string
  }): Promise<string> {
    const response = await httpClient.get('/api/audit/export', {
      params: filters ?? {},
      responseType: 'text',
    })
    return response.data as string
  }
}

export const labApi = new LabApi()
