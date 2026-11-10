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

export interface Announcement {
  id: string
  title: string
  body: string
  status: AnnouncementStatus
  audienceType: 'all' | 'role' | 'user' | 'scope'
  publishAt?: string | null
  expiresAt?: string | null
  publishedAt?: string | null
  withdrawnAt?: string | null
  createdBy?: string | null
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
}

export interface UpdateAnnouncementInput extends Partial<CreateAnnouncementInput> {}

export interface AnnouncementStats {
  total: number
  delivered: number
  read: number
  failed: number
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
  async publish(id: string): Promise<{ announcement: Announcement; delivered: number }> {
    return unwrap<{ announcement: Announcement; delivered: number }>(
      await httpClient.post(`/api/announcements/${id}/publish`, {}),
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
