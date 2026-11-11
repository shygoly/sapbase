import { httpClient } from './client'

export type AnnouncementStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'withdrawn'
  | 'expired'

export interface AnnouncementAudienceInput {
  type: 'role' | 'user' | 'scope_node' | 'scope_subtree'
  value: string
}

export interface AnnouncementAttachment {
  name: string
  url: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  status: AnnouncementStatus
  audienceType: 'all' | 'role' | 'user' | 'scope_node' | 'scope_subtree'
  publishAt?: string | null
  expiresAt?: string | null
  publishedAt?: string | null
  withdrawnAt?: string | null
  createdBy?: string | null
  retentionDays?: number
  attachments?: AnnouncementAttachment[] | null
  createdAt?: string
  updatedAt?: string
}

export interface CreateAnnouncementInput {
  title: string
  body: string
  audienceType?: Announcement['audienceType']
  audiences?: AnnouncementAudienceInput[]
  publishAt?: string | null
  expiresAt?: string | null
  retentionDays?: number
  attachments?: AnnouncementAttachment[]
}

export interface UpdateAnnouncementInput extends Partial<CreateAnnouncementInput> {}

export interface AnnouncementStats {
  total: number
  delivered: number
  read: number
  failed: number
}

export interface AnnouncementDelivery {
  id: string
  announcementId: string
  userId: string
  status: 'pending' | 'delivered' | 'read' | 'failed'
  deliveredAt?: string | null
  readAt?: string | null
  error?: string | null
}

export interface AnnouncementDeliveryPage {
  items: AnnouncementDelivery[]
  total: number
  page: number
  pageSize: number
}

export interface AnnouncementPublishResult {
  announcement: Announcement
  delivered: number
  scheduled?: boolean
  queued?: boolean
  jobId?: string
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const announcementsApi = {
  async list(status?: AnnouncementStatus): Promise<Announcement[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : ''
    return unwrap<Announcement[]>(await httpClient.get(`/api/announcements${query}`))
  },
  async get(id: string): Promise<Announcement> {
    return unwrap<Announcement>(await httpClient.get(`/api/announcements/${id}`))
  },
  async create(input: CreateAnnouncementInput): Promise<Announcement> {
    return unwrap<Announcement>(await httpClient.post('/api/announcements', input))
  },
  async update(id: string, input: UpdateAnnouncementInput): Promise<Announcement> {
    return unwrap<Announcement>(await httpClient.patch(`/api/announcements/${id}`, input))
  },
  async publish(id: string, force = false): Promise<AnnouncementPublishResult> {
    return unwrap<AnnouncementPublishResult>(
      await httpClient.post(`/api/announcements/${id}/publish${force ? '?force=true' : ''}`, {}),
    )
  },
  async copy(id: string): Promise<Announcement> {
    return unwrap<Announcement>(await httpClient.post(`/api/announcements/${id}/copy`, {}))
  },
  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    return unwrap<{ id: string; deleted: boolean }>(
      await httpClient.delete(`/api/announcements/${id}`),
    )
  },
  async deliveries(
    id: string,
    params: { page?: number; pageSize?: number; status?: string } = {},
  ): Promise<AnnouncementDeliveryPage> {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    if (params.status) query.set('status', params.status)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return unwrap<AnnouncementDeliveryPage>(
      await httpClient.get(`/api/announcements/${id}/deliveries${suffix}`),
    )
  },
  async withdraw(id: string): Promise<Announcement> {
    return unwrap<Announcement>(await httpClient.post(`/api/announcements/${id}/withdraw`, {}))
  },
  async markRead(id: string): Promise<boolean> {
    return unwrap<boolean>(await httpClient.post(`/api/announcements/${id}/read`, {}))
  },
  async stats(id: string): Promise<AnnouncementStats> {
    return unwrap<AnnouncementStats>(await httpClient.get(`/api/announcements/${id}/stats`))
  },
}
