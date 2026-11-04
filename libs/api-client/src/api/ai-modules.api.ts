import { httpClient } from './client'

export type AIModuleStatus =
  | 'draft'
  | 'testing'
  | 'pending_review'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'unpublished'

export interface AIModule {
  id: string
  name: string
  description?: string
  naturalLanguagePrompt?: string
  patchContent: Record<string, any>
  status: AIModuleStatus
  version: string
  aiModelId?: string
  createdById?: string
  reviewedById?: string
  reviewedAt?: string
  reviewComments?: string
  publishedAt?: string
  unpublishedAt?: string
  testResults?: {
    total: number
    passed: number
    failed: number
    tests: Array<{ id: string; name: string; status: string }>
  }
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface AIModuleTest {
  id: string
  moduleId: string
  testName: string
  entityType: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
  errorMessage?: string
  testData?: Record<string, any>
  result?: Record<string, any>
  executedAt?: string
  duration?: number
}

export interface CreateAIModuleDto {
  name: string
  description?: string
}

export interface GeneratePatchDto {
  prompt: string
}

export interface ReviewModuleDto {
  decision: 'approved' | 'rejected' | 'pending'
  comments?: string
  rejectionReason?: string
}

export const aiModulesApi = {
  async findAll(status?: AIModuleStatus): Promise<AIModule[]> {
    const params = status ? { status } : {}
    const response = await httpClient.get<any>('/api/ai-modules', { params })
    return response.data.data || response.data || []
  },

  async findOne(id: string): Promise<AIModule> {
    const response = await httpClient.get<any>(`/api/ai-modules/${id}`)
    return response.data.data || response.data
  },

  async create(data: CreateAIModuleDto): Promise<AIModule> {
    const response = await httpClient.post<any>('/api/ai-modules', data)
    return response.data.data || response.data
  },

  async update(id: string, data: Partial<AIModule>): Promise<AIModule> {
    const response = await httpClient.patch<any>(`/api/ai-modules/${id}`, data)
    return response.data.data || response.data
  },

  async delete(id: string): Promise<void> {
    await httpClient.delete(`/api/ai-modules/${id}`)
  },

  async generatePatch(id: string, prompt: string): Promise<AIModule> {
    const response = await httpClient.post<any>(`/api/ai-modules/${id}/generate`, { prompt })
    return response.data.data || response.data
  },


  async generateFromDefinition(
    id: string,
    definition: Record<string, any>,
  ): Promise<AIModule> {
    const response = await httpClient.post<any>(
      `/api/ai-modules/${id}/generate-from-definition`,
      { definition },
      { timeout: 120000 },
    )
    return response.data.data || response.data
  },

  async modifyExisting(moduleRegistryId: string, prompt: string): Promise<AIModule> {
    const response = await httpClient.post<any>('/api/ai-modules/modify', { moduleRegistryId, prompt })
    return response.data.data || response.data
  },

  async generateDefinitionStep(
    stepId: string,
    userInput: string,
    context?: string,
  ): Promise<Record<string, any>> {
    const response = await httpClient.post<any>(
      '/api/ai-modules/definition-step',
      {
        stepId,
        userInput: userInput ?? '',
        ...(context != null && context.trim() !== '' ? { context: context.trim() } : {}),
      },
      // Definition generation can take longer for large prompts.
      { timeout: 120000 },
    )
    return response.data?.data ?? response.data ?? {}
  },

  async generateAllDefinitionSteps(
    userInput: string,
    moduleId?: string,
  ): Promise<Record<string, any>> {
    const response = await httpClient.post<any>(
      '/api/ai-modules/generate-all-steps',
      { userInput: userInput?.trim() ?? '', ...(moduleId ? { moduleId } : {}) },
      { timeout: 300000 },
    )
    return response.data?.data ?? response.data ?? {}
  },

  async runTests(id: string): Promise<AIModuleTest[]> {
    const response = await httpClient.post<any>(`/api/ai-modules/${id}/test`)
    return response.data.data || response.data || []
  },

  async submitForReview(id: string): Promise<AIModule> {
    const response = await httpClient.post<any>(`/api/ai-modules/${id}/submit-review`)
    return response.data.data || response.data
  },

  async review(id: string, data: ReviewModuleDto): Promise<any> {
    const response = await httpClient.post<any>(`/api/ai-modules/${id}/review`, data)
    return response.data.data || response.data
  },

  async publish(id: string): Promise<AIModule> {
    const response = await httpClient.post<any>(`/api/ai-modules/${id}/publish`)
    return response.data.data || response.data
  },

  async unpublish(id: string): Promise<AIModule> {
    const response = await httpClient.post<any>(`/api/ai-modules/${id}/unpublish`)
    return response.data.data || response.data
  },

  async getDefinition(id: string): Promise<any> {
    const response = await httpClient.get<any>(`/api/ai-modules/${id}/definition`)
    return response.data.data || response.data
  },
}
