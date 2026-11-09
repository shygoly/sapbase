/**
 * Data Scope API Service
 * 管理范围维度/节点/成员/绑定/策略，并预览有效范围。
 */
import { httpClient } from './client'

export interface ScopeDimension {
  id: string
  organizationId: string
  key: string
  name: string
  description?: string | null
  config?: Record<string, unknown> | null
  status: 'active' | 'inactive'
}

export interface ScopeNode {
  id: string
  organizationId: string
  dimensionId: string
  parentId?: string | null
  path: string
  depth: number
  name: string
  code?: string | null
  metadata?: Record<string, unknown> | null
  status: 'active' | 'inactive'
}

export interface ScopeMembership {
  id: string
  organizationId: string
  subjectType: 'user' | 'role' | 'group'
  subjectId: string
  nodeId: string
  positionKey: string
  validFrom?: string | null
  validTo?: string | null
}

export interface ScopeBinding {
  id: string
  organizationId: string
  resourceKey: string
  dimensionKey: string
  kind: 'field' | 'owner' | 'relation'
  field?: string | null
  relation?: Record<string, unknown> | null
  writable: boolean
}

export interface DataPolicy {
  id: string
  organizationId: string
  name: string
  subject: Record<string, unknown>
  resourceKey: string
  actions: string[]
  effect: 'allow' | 'deny'
  scope: Record<string, unknown>
  priority: number
  status: 'active' | 'inactive'
}

export interface ScopePreview {
  expr: Record<string, unknown>
  version: number
  declared: boolean
}

function unwrap<T>(response: { data: any }): T {
  return response.data?.data ?? response.data
}

export const dataScopeApi = {
  async listDimensions(): Promise<ScopeDimension[]> {
    return unwrap(await httpClient.get('/api/data-scope/dimensions'))
  },
  async createDimension(input: {
    key: string
    name: string
    description?: string
    config?: Record<string, unknown>
  }): Promise<ScopeDimension> {
    return unwrap(await httpClient.post('/api/data-scope/dimensions', input))
  },
  async deleteDimension(id: string): Promise<void> {
    await httpClient.delete(`/api/data-scope/dimensions/${id}`)
  },

  async listNodes(dimensionId?: string): Promise<ScopeNode[]> {
    return unwrap(
      await httpClient.get('/api/data-scope/nodes', {
        params: dimensionId ? { dimensionId } : undefined,
      }),
    )
  },
  async createNode(input: {
    dimensionId: string
    parentId?: string | null
    name: string
    code?: string
    metadata?: Record<string, unknown>
  }): Promise<ScopeNode> {
    return unwrap(await httpClient.post('/api/data-scope/nodes', input))
  },
  async moveNode(id: string, parentId: string | null): Promise<ScopeNode> {
    return unwrap(await httpClient.put(`/api/data-scope/nodes/${id}/move`, { parentId }))
  },
  async deleteNode(id: string): Promise<void> {
    await httpClient.delete(`/api/data-scope/nodes/${id}`)
  },

  async listMemberships(nodeId?: string): Promise<ScopeMembership[]> {
    return unwrap(
      await httpClient.get('/api/data-scope/memberships', {
        params: nodeId ? { nodeId } : undefined,
      }),
    )
  },
  async createMembership(input: {
    subjectType: 'user' | 'role' | 'group'
    subjectId: string
    nodeId: string
    positionKey: string
    validFrom?: string | null
    validTo?: string | null
  }): Promise<ScopeMembership> {
    return unwrap(await httpClient.post('/api/data-scope/memberships', input))
  },
  async deleteMembership(id: string): Promise<void> {
    await httpClient.delete(`/api/data-scope/memberships/${id}`)
  },

  async listBindings(resourceKey?: string): Promise<ScopeBinding[]> {
    return unwrap(
      await httpClient.get('/api/data-scope/bindings', {
        params: resourceKey ? { resourceKey } : undefined,
      }),
    )
  },
  async createBinding(input: {
    resourceKey: string
    dimensionKey: string
    kind: 'field' | 'owner' | 'relation'
    field?: string | null
    relation?: Record<string, unknown> | null
    writable?: boolean
  }): Promise<ScopeBinding> {
    return unwrap(await httpClient.post('/api/data-scope/bindings', input))
  },
  async deleteBinding(id: string): Promise<void> {
    await httpClient.delete(`/api/data-scope/bindings/${id}`)
  },

  async listPolicies(resourceKey?: string): Promise<DataPolicy[]> {
    return unwrap(
      await httpClient.get('/api/data-scope/policies', {
        params: resourceKey ? { resourceKey } : undefined,
      }),
    )
  },
  async createPolicy(input: {
    name: string
    subject: Record<string, unknown>
    resourceKey: string
    actions: string[]
    effect?: 'allow' | 'deny'
    scope: Record<string, unknown>
    priority?: number
  }): Promise<DataPolicy> {
    return unwrap(await httpClient.post('/api/data-scope/policies', input))
  },
  async deletePolicy(id: string): Promise<void> {
    await httpClient.delete(`/api/data-scope/policies/${id}`)
  },

  async preview(input: { resourceKey: string; action: string }): Promise<ScopePreview> {
    return unwrap(await httpClient.post('/api/data-scope/preview', input))
  },
}
