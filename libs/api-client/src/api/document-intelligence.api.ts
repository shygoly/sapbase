import { httpClient } from './client'

export interface DocumentRun {
  id: string
  assetId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  stage: string | null
  progress: number
  parser: string | null
  sourceName: string | null
  pageCount: number
  draftVersion: number
  confirmedVersion: number | null
  error: string | null
}

export interface DocumentSection {
  id: string
  key: string
  parentKey: string | null
  title: string
  level: number
  ordinal: number
  content: string
  pageNumber: number | null
  anchor: Record<string, unknown>
}

export interface DocumentCandidate {
  id: string
  key: string
  sectionKey: string
  kind: 'knowledge' | 'concept' | 'relation'
  title: string
  body: string
  confidence: string
  anchor: Record<string, unknown>
  status: 'pending' | 'accepted' | 'rejected'
  targetResourceKey: string | null
  targetEntityId: string | null
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const documentIntelligenceApi = {
  async runs(): Promise<DocumentRun[]> {
    return unwrap(await httpClient.get('/api/document-intelligence/runs'))
  },
  async createRun(assetId: string): Promise<{ run: DocumentRun; jobId: string }> {
    return unwrap(await httpClient.post('/api/document-intelligence/runs', { assetId }))
  },
  async draft(runId: string): Promise<{ run: DocumentRun; sections: DocumentSection[]; candidates: DocumentCandidate[] }> {
    return unwrap(await httpClient.get(`/api/document-intelligence/runs/${runId}`))
  },
  async updateCandidate(
    id: string,
    input: Partial<Pick<DocumentCandidate, 'title' | 'body' | 'status' | 'confidence'>>,
  ): Promise<DocumentCandidate> {
    return unwrap(await httpClient.patch(`/api/document-intelligence/candidates/${id}`, input))
  },
  async confirmCandidates(runId: string, keys?: string[]): Promise<{ accepted: number }> {
    return unwrap(
      await httpClient.post(`/api/document-intelligence/runs/${runId}/candidates/confirm`, { keys }),
    )
  },
  async mergeSections(runId: string, sourceKey: string, targetKey: string) {
    return unwrap(
      await httpClient.post(`/api/document-intelligence/runs/${runId}/sections/merge`, {
        sourceKey,
        targetKey,
      }),
    )
  },
  async splitSection(runId: string, sectionKey: string, at: number, title?: string) {
    return unwrap(
      await httpClient.post(`/api/document-intelligence/runs/${runId}/sections/split`, {
        sectionKey,
        at,
        title,
      }),
    )
  },
  async reorder(runId: string, keys: string[]) {
    return unwrap(
      await httpClient.post(`/api/document-intelligence/runs/${runId}/sections/reorder`, { keys }),
    )
  },
  async confirm(runId: string): Promise<DocumentRun> {
    return unwrap(await httpClient.post(`/api/document-intelligence/runs/${runId}/confirm`, {}))
  },
  async convert(
    runId: string,
    input: { targetResourceKey: 'knowledge' | 'course' | 'section'; packageId?: string; entity?: string },
  ): Promise<{ runId: string; converted: Array<{ candidateId: string; entityId: string }> }> {
    return unwrap(
      await httpClient.post(`/api/document-intelligence/runs/${runId}/convert`, input),
    )
  },
  async cancel(runId: string): Promise<DocumentRun> {
    return unwrap(await httpClient.post(`/api/document-intelligence/runs/${runId}/cancel`, {}))
  },
}
