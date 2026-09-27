/**
 * 蓝图运行时客户端（W2 起 admin/workflows 只走这里）。
 * W3 起旧 workflows.api.ts 已删；旧 HTTP 路径由后端 410 墓碑给出迁移指引。
 */

import { httpClient } from './client'

export interface BlueprintManifest {
  blueprint: string
  version: string
  [key: string]: unknown
}

export interface BlueprintSummary {
  id: string
  file: string
  manifest: BlueprintManifest
}

export interface SemanticState {
  name: string
  initial: boolean
  final: boolean
}

export interface SemanticTransition {
  from: string
  to: string
}

export interface SemanticEntity {
  name: string
  children?: string[]
  states: SemanticState[]
  transitions: SemanticTransition[]
}

export interface SemanticDeclaration {
  entities: SemanticEntity[]
}

export interface RecordEnvelope {
  id: string
  blueprintId: string
  blueprintVersion: string
  entity: string
  data: Record<string, unknown>
  state?: string
  version: number
  omittedFields?: string[]
  organizationId?: string
  createdAt?: string
  updatedAt?: string
}

export interface RecordPage {
  items: RecordEnvelope[]
  total: number
  page: number
  pageSize: number
  sort?: string
  order?: string
}

export interface TransitionHistoryEntry {
  at: string
  actor: string
  from: string
  to: string
}

export interface SuggestedTransition {
  to: string
  requiresApproval: boolean
  pendingApproval?: { ruleId: string; role: string }
}

export interface TransitionBody {
  to: string
  expectedVersion?: number
}

export interface ListRecordsQuery {
  state?: string
  page?: number
  pageSize?: number
  sort?: string
  order?: 'asc' | 'desc'
  filter?: string
}

/**
 * 生产环境有 { code, message, data } 信封；记录本身也有 data 字段。
 * 只在带 code 的信封上拆包，避免把记录的 data 误当成载荷。
 */
function unwrap<T>(response: { data: unknown }): T {
  const body = response.data
  if (
    body != null &&
    typeof body === 'object' &&
    'code' in body &&
    'data' in body &&
    (body as { data?: T }).data !== undefined
  ) {
    return (body as { data: T }).data
  }
  return body as T
}

class BlueprintsApi {
  async listBlueprints(): Promise<BlueprintSummary[]> {
    const response = await httpClient.get<unknown>('/api/blueprints')
    return unwrap<BlueprintSummary[]>(response) ?? []
  }

  async getSemantic(packageId: string): Promise<SemanticDeclaration> {
    const response = await httpClient.get<unknown>(
      `/api/blueprints/${encodeURIComponent(packageId)}/semantic`,
    )
    return unwrap<SemanticDeclaration>(response)
  }

  async listRecords(packageId: string, entity: string, query: ListRecordsQuery = {}): Promise<RecordPage> {
    const params: Record<string, string | number> = {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    }
    if (query.state) params.state = query.state
    if (query.sort) params.sort = query.sort
    if (query.order) params.order = query.order
    if (query.filter) params.filter = query.filter
    const response = await httpClient.get<unknown>(
      `/api/blueprints/${encodeURIComponent(packageId)}/records/${encodeURIComponent(entity)}`,
      { params },
    )
    return unwrap<RecordPage>(response)
  }

  async getRecord(packageId: string, entity: string, recordId: string): Promise<RecordEnvelope> {
    const response = await httpClient.get<unknown>(
      `/api/blueprints/${encodeURIComponent(packageId)}/records/${encodeURIComponent(entity)}/${encodeURIComponent(recordId)}`,
    )
    return unwrap<RecordEnvelope>(response)
  }

  async executeTransition(
    packageId: string,
    entity: string,
    recordId: string,
    body: TransitionBody,
  ): Promise<RecordEnvelope> {
    const response = await httpClient.post<unknown>(
      `/api/blueprints/${encodeURIComponent(packageId)}/records/${encodeURIComponent(entity)}/${encodeURIComponent(recordId)}/transition`,
      body,
    )
    return unwrap<RecordEnvelope>(response)
  }

  async getHistory(
    packageId: string,
    entity: string,
    recordId: string,
  ): Promise<TransitionHistoryEntry[]> {
    const response = await httpClient.get<unknown>(
      `/api/blueprints/${encodeURIComponent(packageId)}/records/${encodeURIComponent(entity)}/${encodeURIComponent(recordId)}/history`,
    )
    return unwrap<TransitionHistoryEntry[]>(response) ?? []
  }

  async getSuggestedTransitions(
    packageId: string,
    entity: string,
    recordId: string,
  ): Promise<SuggestedTransition[]> {
    const response = await httpClient.get<unknown>(
      `/api/blueprints/${encodeURIComponent(packageId)}/records/${encodeURIComponent(entity)}/${encodeURIComponent(recordId)}/suggested-transitions`,
    )
    return unwrap<SuggestedTransition[]>(response) ?? []
  }
}

export const blueprintsApi = new BlueprintsApi()
