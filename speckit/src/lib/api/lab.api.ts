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
}

export const labApi = new LabApi()
