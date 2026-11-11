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


export interface AIModuleDslSummary {
  id: string
  name: string
  description: string | null
  status: AIModuleStatus
  version: string
  updatedAt: string
  dslKeys: string[]
  hasDefinition: boolean
}

export interface AIModuleDslBundle {
  module: {
    id: string
    name: string
    description: string | null
    status: AIModuleStatus
    version: string
    updatedAt: string
  }
  patchContent: Record<string, any>
  definition: Record<string, any> | null
}

export interface AIModuleDslSearchResult {
  items: AIModuleDslSummary[]
  total: number
  page: number
  limit: number
}

export interface AIModuleVersion {
  id: string
  moduleId: string
  version: string
  patchContent: Record<string, any>
  metadata: Record<string, any> | null
  definition: Record<string, any> | null
  status: AIModuleStatus
  actor: string
  reason: string | null
  createdAt: string
}

export interface AIModuleVersionPage {
  items: AIModuleVersion[]
  total: number
  page: number
  pageSize: number
}

export interface AIModuleVersionDiff {
  moduleId: string
  from: { id: string; version: string; createdAt: string }
  to: { id: string; version: string; createdAt: string }
  changes: Array<{ path: string; from: unknown; to: unknown }>
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

  async getBlueprint(id: string): Promise<Record<string, any>> {
    const response = await httpClient.get<any>(`/api/ai-modules/${id}/blueprint`)
    return response.data.data || response.data
  },

  async getBlueprintUi(id: string): Promise<Record<string, any>> {
    const response = await httpClient.get<any>(`/api/blueprints/${id}/ui`)
    return response.data.data || response.data
  },

  async getBlueprintPermissions(id: string): Promise<Record<string, any>> {
    const response = await httpClient.get<any>(`/api/blueprints/${id}/permissions`)
    return response.data.data || response.data
  },

  async deliverBlueprint(
    id: string,
    input: {
      grantedTo: string[]
      expiresAt?: string
      issuer?: string
      resell?: boolean
    },
  ): Promise<Record<string, any>> {
    const response = await httpClient.post<any>(
      `/api/ai-modules/${id}/blueprint/deliver`,
      input,
      { timeout: 120000 },
    )
    return response.data.data || response.data
  },

  async applyDefinitionPatch(
    id: string,
    patch: Record<string, any>,
    confirmed = false,
  ): Promise<AIModule> {
    const response = await httpClient.post<any>(
      `/api/ai-modules/${id}/patches/apply`,
      { patch, confirmed },
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

  async searchDsl(params: { search?: string; page?: number; limit?: number } = {}): Promise<AIModuleDslSearchResult> {
    const response = await httpClient.get<any>('/api/ai-modules/dsl', { params })
    return response.data.data || response.data
  },

  async getDsl(id: string): Promise<AIModuleDslBundle> {
    const response = await httpClient.get<any>(`/api/ai-modules/${id}/dsl`)
    return response.data.data || response.data
  },

  async listVersions(
    id: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<AIModuleVersionPage> {
    const response = await httpClient.get<any>(`/api/ai-modules/${id}/versions`, { params })
    return response.data.data || response.data
  },

  async getVersion(id: string, versionId: string): Promise<AIModuleVersion> {
    const response = await httpClient.get<any>(`/api/ai-modules/${id}/versions/${versionId}`)
    return response.data.data || response.data
  },

  async diffVersions(id: string, from: string, to: string): Promise<AIModuleVersionDiff> {
    const response = await httpClient.get<any>(`/api/ai-modules/${id}/versions/diff`, {
      params: { from, to },
    })
    return response.data.data || response.data
  },

  async rollbackVersion(id: string, versionId: string): Promise<AIModule> {
    const response = await httpClient.post<any>(
      `/api/ai-modules/${id}/versions/${versionId}/rollback`,
    )
    return response.data.data || response.data
  },

  async exportDsl(id: string): Promise<string> {
    const bundle = await this.getDsl(id)
    return JSON.stringify(
      {
        module: bundle.module,
        patchContent: bundle.patchContent,
        definition: bundle.definition,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    )
  },
}
