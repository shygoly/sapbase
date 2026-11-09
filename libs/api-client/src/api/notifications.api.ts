import { httpClient } from './client'

export interface NotificationItem {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  body?: string | null
  message?: string | null
  read: boolean
  createdAt: string
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const notificationsApi = {
  async list(all = false): Promise<NotificationItem[]> {
    const result = unwrap<{ notifications?: NotificationItem[] }>(
      await httpClient.get(`/api/notifications${all ? '?all=true' : ''}`),
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
}
