/**
 * Async Jobs API Service
 * 外部任务门面：创建/查询/取消/重试/事件/回调重放。
 */
import { httpClient } from './client'

export type JobStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'dead'

export interface Job {
  id: string
  organizationId: string
  appInstallationId?: string | null
  type: string
  typeVersion: number
  status: JobStatus
  priority: number
  payload: Record<string, unknown>
  result?: Record<string, unknown> | null
  error?: Record<string, unknown> | null
  progress: number
  idempotencyKey?: string | null
  attempts: number
  maxAttempts: number
  runAt: string
  startedAt?: string | null
  finishedAt?: string | null
  leaseUntil?: string | null
  workerId?: string | null
  cancelRequested: boolean
  callbackUrl?: string | null
  callbackSecretRef?: string | null
  callbackStatus?: string | null
  callbackAttempts: number
  createdBy?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface JobEvent {
  id: string
  jobId: string
  seq: number
  type: 'progress' | 'stage' | 'log' | 'callback' | 'error'
  payload: Record<string, unknown>
  createdAt: string
}

export interface CreateJobInput {
  type: string
  typeVersion?: number
  payload?: Record<string, unknown>
  idempotencyKey?: string
  callbackUrl?: string
  callbackSecretRef?: string
  priority?: number
}

export interface JobListResult {
  items: Job[]
  total: number
}

function unwrap<T>(response: { data: any }): T {
  return response.data?.data ?? response.data
}

export const jobsApi = {
  async create(input: CreateJobInput): Promise<{ job: Job; created: boolean }> {
    return unwrap(await httpClient.post('/api/jobs', input))
  },

  async list(filters: {
    status?: JobStatus
    type?: string
    page?: number
    pageSize?: number
  } = {}): Promise<JobListResult> {
    return unwrap(await httpClient.get('/api/jobs', { params: filters }))
  },

  async get(id: string): Promise<Job> {
    return unwrap(await httpClient.get(`/api/jobs/${id}`))
  },

  async events(id: string, afterSeq = 0): Promise<JobEvent[]> {
    return unwrap(
      await httpClient.get(`/api/jobs/${id}/events`, { params: { afterSeq } }),
    )
  },

  async cancel(id: string): Promise<Job> {
    return unwrap(await httpClient.post(`/api/jobs/${id}/cancel`, {}))
  },

  async retry(id: string): Promise<Job> {
    return unwrap(await httpClient.post(`/api/jobs/${id}/retry`, {}))
  },

  async replayCallback(id: string): Promise<{
    outcome: 'delivered' | 'retryable' | 'permanent' | 'skipped'
    attempts: number
    status?: number
    error?: string
  }> {
    return unwrap(await httpClient.post(`/api/jobs/${id}/callback/replay`, {}))
  },
}
