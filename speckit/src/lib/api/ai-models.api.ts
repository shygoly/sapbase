import { httpClient } from './client'

export interface AIModel {
  id: string
  name: string
  provider: 'kimi' | 'openai' | 'anthropic'
  apiKey?: string
  baseUrl?: string
  model?: string
  status: 'active' | 'inactive' | 'testing'
  description?: string
  config?: Record<string, any>
  lastTestedAt?: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateAIModelDto {
  name: string
  provider: 'kimi' | 'openai' | 'anthropic'
  apiKey?: string
  baseUrl?: string
  model?: string
  description?: string
  config?: Record<string, any>
  isDefault?: boolean
}

export interface UpdateAIModelDto extends Partial<CreateAIModelDto> {}

export const aiModelsApi = {
  async findAll(): Promise<AIModel[]> {
    const response = await httpClient.get<any>('/api/ai-models')
    return response.data.data || response.data || []
  },

  async findOne(id: string): Promise<AIModel> {
    const response = await httpClient.get<any>(`/api/ai-models/${id}`)
    return response.data.data || response.data
  },

  async findDefault(): Promise<AIModel | null> {
    const response = await httpClient.get<any>('/api/ai-models/default')
    return response.data.data || response.data || null
  },

  async create(data: CreateAIModelDto): Promise<AIModel> {
    const response = await httpClient.post<any>('/api/ai-models', data)
    return response.data.data || response.data
  },

  async update(id: string, data: UpdateAIModelDto): Promise<AIModel> {
    const response = await httpClient.patch<any>(`/api/ai-models/${id}`, data)
    return response.data.data || response.data
  },

  async delete(id: string): Promise<void> {
    await httpClient.delete(`/api/ai-models/${id}`)
  },

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const response = await httpClient.post<any>(`/api/ai-models/${id}/test`)
    return response.data.data || response.data
  },
}
