import { httpClient } from './client'

export type AiContentType = 'text' | 'image' | 'audio' | 'video' | 'asset' | 'module'
export type ContentLabelType = 'explicit' | 'implicit'
export type AiScoreStatus = 'ai_only' | 'teacher_confirmed' | 'appealed' | 'final'

export interface AiProvenance {
  id: string
  contentId: string
  contentType: AiContentType
  producer: string
  agent: string | null
  model: string | null
  promptHash: string | null
  taskId: string | null
  contentHash: string
  parentContentId: string | null
  version: number
  createdAt: string
}

export interface AiLabel {
  id: string
  contentId: string
  labelType: ContentLabelType
  version: number
  text: string
  status: 'pending' | 'applied' | 'failed'
  appliedAt: string | null
  verifiedAt: string | null
}

export interface AiScore {
  id: string
  contentId: string | null
  subjectType: string
  subjectId: string
  aiScore: string | null
  humanScore: string | null
  status: AiScoreStatus
  ruleVersion: string | null
  confirmedBy: string | null
  confirmedAt: string | null
  appealReason: string | null
}

export interface AiGateResult {
  allowed: boolean
  reason?: string
  round?: number
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const aiGovernanceApi = {
  async recordProvenance(input: {
    contentId: string
    contentType: AiContentType
    producer: string
    content: string
    agent?: string
    model?: string
    prompt?: string
    templateRef?: string
    taskId?: string
    parentContentId?: string
  }): Promise<AiProvenance> {
    return unwrap(await httpClient.post('/api/ai-governance/provenance', input))
  },

  async provenance(contentId: string): Promise<AiProvenance[]> {
    return unwrap(await httpClient.get(`/api/ai-governance/provenance/${contentId}`))
  },

  async applyLabel(input: {
    contentId: string
    labelType: ContentLabelType
    text?: string
  }): Promise<AiLabel> {
    return unwrap(await httpClient.post('/api/ai-governance/labels', input))
  },

  async verifyLabel(input: {
    contentId: string
    labelType: ContentLabelType
  }): Promise<{ valid: boolean; reason?: string }> {
    return unwrap(await httpClient.post('/api/ai-governance/labels/verify', input))
  },

  async labels(contentId: string): Promise<AiLabel[]> {
    return unwrap(await httpClient.get(`/api/ai-governance/labels/${contentId}`))
  },

  async submitReview(input: {
    contentId: string
    text: string
  }): Promise<{ round: number; safety: { status: string } }> {
    return unwrap(await httpClient.post('/api/ai-governance/review/submit', input))
  },

  async gate(contentId: string): Promise<AiGateResult> {
    return unwrap(await httpClient.get(`/api/ai-governance/gate/${contentId}`))
  },

  async createScore(input: {
    contentId?: string
    subjectType: string
    subjectId: string
    aiScore?: number
    ruleVersion?: string
  }): Promise<AiScore> {
    return unwrap(await httpClient.post('/api/ai-governance/scores', input))
  },

  async listScores(params: {
    subjectType?: string
    subjectId?: string
    contentId?: string
  } = {}): Promise<AiScore[]> {
    const query = new URLSearchParams()
    if (params.subjectType) query.set('subjectType', params.subjectType)
    if (params.subjectId) query.set('subjectId', params.subjectId)
    if (params.contentId) query.set('contentId', params.contentId)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return unwrap(await httpClient.get(`/api/ai-governance/scores${suffix}`))
  },

  async confirmScore(id: string, humanScore: number): Promise<AiScore> {
    return unwrap(
      await httpClient.post(`/api/ai-governance/scores/${id}/confirm`, { humanScore }),
    )
  },

  async appealScore(id: string, reason: string): Promise<AiScore> {
    return unwrap(
      await httpClient.post(`/api/ai-governance/scores/${id}/appeal`, { reason }),
    )
  },

  async finalizeScore(id: string): Promise<AiScore> {
    return unwrap(await httpClient.post(`/api/ai-governance/scores/${id}/finalize`, {}))
  },

  async confirmRule(input: {
    subjectType: string
    subjectId: string
    ruleVersion: string
  }): Promise<AiScore> {
    return unwrap(await httpClient.post('/api/ai-governance/scores/rule-confirm', input))
  },
}
