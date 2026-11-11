import { httpClient } from './client'

export type WorkItemStatus = 'open' | 'done' | 'dismissed'
export type WorkItemPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface WorkItem {
  id: string
  organizationId: string
  sourceType: string
  sourceId: string
  title: string
  status: WorkItemStatus
  assigneeId: string | null
  priority: WorkItemPriority
  dueAt: string | null
  readAt: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface ReviewStep {
  id: string
  organizationId: string
  blueprintId: string
  blueprintVersion: string
  entity: string
  recordId: string
  ruleId: string
  round: number
  stepIndex: number
  role: string
  kind: 'human' | 'check'
  selector: Record<string, unknown> | null
  assignee: Record<string, unknown> | null
  checkProvider: string | null
  checkResult: { status?: 'pass' | 'warn' | 'fail'; evidence?: Record<string, unknown> } | null
  status: 'pending' | 'approved' | 'rejected'
  comment: string | null
  decidedBy: string | null
  dueAt: string | null
  reminderSentAt: string | null
  escalatedAt: string | null
  createdAt: string
}

export interface ReviewComment {
  id: string
  approvalId: string
  recordId: string
  authorId: string | null
  body: string
  parentId: string | null
  attachments: Array<Record<string, unknown>> | null
  visibility: 'all' | 'internal'
  createdAt: string
}

export interface ReviewEvent {
  id: string
  approvalId: string
  recordId: string
  type: string
  actorId: string | null
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface ReviewDelegation {
  id: string
  approvalId: string
  fromUserId: string
  toUserId: string
  reason: string | null
  validFrom: string | null
  validTo: string | null
  status: 'active' | 'revoked'
}

export interface ReviewOverview {
  pending: number
  overdue: number
  escalated: number
  checkSteps: number
  checkProviders: string[]
  sla: { scanCron: string; remindBeforeHours: number }
  selectors: string[]
  items: ReviewStep[]
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data
  }
  return body as T
}

export const reviewApi = {
  async listWorkItems(params: {
    status?: WorkItemStatus
    sourceType?: string
    unread?: boolean
    assignee?: string
    limit?: number
  } = {}): Promise<WorkItem[]> {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.sourceType) query.set('sourceType', params.sourceType)
    if (params.unread) query.set('unread', 'true')
    if (params.assignee) query.set('assignee', params.assignee)
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return unwrap<WorkItem[]>(await httpClient.get(`/api/review/work-items${suffix}`))
  },

  async unreadCount(assignee = 'me'): Promise<{ count: number }> {
    return unwrap<{ count: number }>(
      await httpClient.get(`/api/review/work-items/unread-count?assignee=${assignee}`),
    )
  },

  async markRead(id: string): Promise<boolean> {
    return unwrap<boolean>(await httpClient.post(`/api/review/work-items/${id}/read`, {}))
  },

  async markAllRead(): Promise<{ updated: number }> {
    return unwrap<{ updated: number }>(
      await httpClient.post('/api/review/work-items/read-all', {}),
    )
  },

  async overview(): Promise<ReviewOverview> {
    return unwrap<ReviewOverview>(await httpClient.get('/api/review/overview'))
  },

  async listApprovals(params: {
    status?: string
    recordId?: string
    ruleId?: string
    limit?: number
  } = {}): Promise<ReviewStep[]> {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.recordId) query.set('recordId', params.recordId)
    if (params.ruleId) query.set('ruleId', params.ruleId)
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return unwrap<ReviewStep[]>(await httpClient.get(`/api/review/approvals${suffix}`))
  },

  async approval(id: string): Promise<{
    step: ReviewStep
    chain: ReviewStep[]
    delegations: ReviewDelegation[]
  }> {
    return unwrap(await httpClient.get(`/api/review/approvals/${id}`))
  },

  async act(
    id: string,
    action: 'approve' | 'reject' | 'request-changes',
    comment?: string,
  ): Promise<ReviewStep> {
    return unwrap<ReviewStep>(
      await httpClient.post(`/api/review/approvals/${id}/act`, { action, comment }),
    )
  },

  async resubmit(id: string, comment?: string): Promise<ReviewStep[]> {
    return unwrap<ReviewStep[]>(
      await httpClient.post(`/api/review/approvals/${id}/resubmit`, { comment }),
    )
  },

  async comments(id: string): Promise<ReviewComment[]> {
    return unwrap<ReviewComment[]>(await httpClient.get(`/api/review/approvals/${id}/comments`))
  },

  async addComment(
    id: string,
    input: { body: string; attachmentAssetIds?: string[]; visibility?: 'all' | 'internal' },
  ): Promise<ReviewComment> {
    return unwrap<ReviewComment>(
      await httpClient.post(`/api/review/approvals/${id}/comments`, input),
    )
  },

  async events(id: string): Promise<ReviewEvent[]> {
    return unwrap<ReviewEvent[]>(await httpClient.get(`/api/review/approvals/${id}/events`))
  },

  async delegate(
    id: string,
    input: { toUserId: string; reason?: string; validFrom?: string; validTo?: string },
  ): Promise<ReviewDelegation> {
    return unwrap<ReviewDelegation>(
      await httpClient.post(`/api/review/approvals/${id}/delegate`, input),
    )
  },

  async revokeDelegation(id: string): Promise<ReviewDelegation> {
    return unwrap<ReviewDelegation>(await httpClient.delete(`/api/review/delegations/${id}`))
  },

  async reconcile(): Promise<{
    scanned: number
    reassigned: number
    blocked: number
    projected: number
    closed: number
  }> {
    return unwrap(await httpClient.post('/api/review/reconcile', {}))
  },
}
