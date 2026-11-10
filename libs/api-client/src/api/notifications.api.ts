import { httpClient } from './client'

export type NotificationCategory =
  | 'system'
  | 'approval'
  | 'announcement'
  | 'task'
  | 'security'
  | 'business'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface NotificationItem {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  body?: string | null
  message?: string | null
  read: boolean
  createdAt: string
  category?: NotificationCategory
  priority?: NotificationPriority
  actionUrl?: string | null
  expiresAt?: string | null
  readAt?: string | null
  mandatory?: boolean
  data?: Record<string, unknown> | null
}

export interface NotificationPreference {
  category: NotificationCategory
  inApp: boolean
  email: boolean
  push: boolean
  mutedUntil?: string | null
}

export interface NotificationListFilters {
  category?: string
  priority?: string
  includeExpired?: boolean
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const notificationsApi = {
  async list(all = false, filters: NotificationListFilters = {}): Promise<NotificationItem[]> {
    const params = new URLSearchParams()
    if (all) params.set('all', 'true')
    if (filters.category) params.set('category', filters.category)
    if (filters.priority) params.set('priority', filters.priority)
    if (filters.includeExpired) params.set('includeExpired', 'true')
    const query = params.toString()
    const result = unwrap<{ notifications?: NotificationItem[] }>(
      await httpClient.get(`/api/notifications${query ? `?${query}` : ''}`),
    )
    return result.notifications ?? []
  },
  async unreadCount(): Promise<number> {
    const result = unwrap<{ count?: number }>(await httpClient.get('/api/notifications/unread-count'))
    return result.count ?? 0
  },
  async markRead(id: string): Promise<void> {
    await httpClient.post(`/api/notifications/${id}/read`, {})
  },
  async markAllRead(): Promise<number> {
    const result = unwrap<{ updated?: number }>(
      await httpClient.post('/api/notifications/read-all', {}),
    )
    return result.updated ?? 0
  },
  async preferences(): Promise<NotificationPreference[]> {
    const result = unwrap<NotificationPreference[] | { preferences?: NotificationPreference[] }>(
      await httpClient.get('/api/notifications/preferences'),
    )
    return Array.isArray(result) ? result : result.preferences ?? []
  },
  async updatePreference(
    category: string,
    input: { inApp?: boolean; email?: boolean; push?: boolean; mutedUntil?: string | null },
  ): Promise<NotificationPreference> {
    return unwrap<NotificationPreference>(
      await httpClient.post(
        `/api/notifications/preferences/${encodeURIComponent(category)}`,
        input,
      ),
    )
  },
}
