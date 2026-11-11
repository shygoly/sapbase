import { httpClient } from './client'

export interface SearchHit {
  id: string
  resourceKey: 'announcement' | 'asset' | 'ai_module' | 'agent_knowledge'
  resourceId: string
  title: string
  snippet: string
  tags: string[]
  metadata: Record<string, unknown>
  rank: number
  indexedAt: string
}

export interface SearchResult {
  items: SearchHit[]
  total: number
  page: number
  pageSize: number
  tookMs: number
}

export interface SearchParams {
  q?: string
  types?: string[]
  tags?: string[]
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data
  }
  return body as T
}

export const searchApi = {
  async query(params: SearchParams = {}): Promise<SearchResult> {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.types?.length) query.set('types', params.types.join(','))
    if (params.tags?.length) query.set('tags', params.tags.join(','))
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return unwrap<SearchResult>(await httpClient.get(`/api/search${suffix}`))
  },

  async reindex(): Promise<Record<string, number>> {
    return unwrap<Record<string, number>>(await httpClient.post('/api/search/reindex', {}))
  },

  async index(resourceKey: string, resourceId: string): Promise<{ indexed: boolean }> {
    return unwrap<{ indexed: boolean }>(
      await httpClient.post('/api/search/index', { resourceKey, resourceId }),
    )
  },
}
