import { httpClient } from './client'

export interface DeployResponse {
  deployId: string
  status: string
}

export const systemApi = {
  async deploy(options?: { jobId?: string; moduleId?: string }): Promise<DeployResponse> {
    const response = await httpClient.post<any>('/api/system/deploy', options ?? {})
    return response.data?.data ?? response.data ?? { deployId: '', status: 'queued' }
  },
}
