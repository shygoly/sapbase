import {
  AppToolCatalogError,
  composeAppToolCatalog,
  filterAppToolCatalog,
} from '@sap/agent-tools/app-tool-catalog'
import type { AgentToolContract } from '@sap/agent-tools/contracts-loader'

function tool(
  name: string,
  permission = 'tool:blueprint:read',
  extra: Partial<AgentToolContract> = {},
): AgentToolContract {
  return {
    name,
    description: `${name} test tool`,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    permission,
    write: false,
    confirmation: 'none',
    timeoutMs: 1000,
    untrustedResult: false,
    sensitiveArgs: [],
    ...extra,
  }
}

const context = { appKey: 'crm', appInstallationId: 'app-crm' }

describe('composeAppToolCatalog', () => {
  it('组合平台内建 + 应用命名空间工具', () => {
    const result = composeAppToolCatalog(context, [
      { kind: 'platform', label: 'platform', catalog: { version: 1, tools: [tool('erp_blueprint_list')] } },
      { kind: 'blueprint', label: 'crm', catalog: { version: 1, tools: [tool('crm_customer_lookup')] } },
      { kind: 'integration', label: 'crm-connector', catalog: { version: 1, tools: [tool('crm_sync_status')] } },
    ])
    expect(result.tools.map((item) => item.name)).toEqual([
      'erp_blueprint_list',
      'crm_customer_lookup',
      'crm_sync_status',
    ])
    expect(result.sources).toEqual([
      { kind: 'platform', label: 'platform', count: 1 },
      { kind: 'blueprint', label: 'crm', count: 1 },
      { kind: 'integration', label: 'crm-connector', count: 1 },
    ])
  })

  it('重名 → 整个目录无效（不静默去重）', () => {
    expect(() =>
      composeAppToolCatalog(context, [
        { kind: 'platform', catalog: { version: 1, tools: [tool('crm_customer_lookup')] } },
        { kind: 'blueprint', catalog: { version: 1, tools: [tool('crm_customer_lookup')] } },
      ]),
    ).toThrow(AppToolCatalogError)
    try {
      composeAppToolCatalog(context, [
        { kind: 'platform', catalog: { version: 1, tools: [tool('crm_customer_lookup')] } },
        { kind: 'blueprint', catalog: { version: 1, tools: [tool('crm_customer_lookup')] } },
      ])
    } catch (error) {
      expect((error as AppToolCatalogError).reason).toBe('duplicate')
    }
  })

  it('应用来源工具必须使用 appKey 命名空间', () => {
    try {
      composeAppToolCatalog(context, [
        { kind: 'blueprint', catalog: { version: 1, tools: [tool('customer_lookup')] } },
      ])
      throw new Error('should reject')
    } catch (error) {
      expect(error).toBeInstanceOf(AppToolCatalogError)
      expect((error as AppToolCatalogError).reason).toBe('namespace')
    }
  })

  it('平台内建保留平台命名空间（crm 应用仍可见 erp_* 内建）', () => {
    const result = composeAppToolCatalog(context, [
      { kind: 'platform', catalog: { version: 1, tools: [tool('erp_blueprint_list')] } },
    ])
    expect(result.tools).toHaveLength(1)
  })

  it('按可信 Agent profile / 权限 / entitlement 过滤，并返回隐藏原因', () => {
    const catalog = composeAppToolCatalog(context, [
      { kind: 'platform', label: 'platform', catalog: { version: 1, tools: [tool('erp_blueprint_list')] } },
      {
        kind: 'blueprint',
        label: 'crm',
        catalog: {
          version: 1,
          tools: [
            tool('crm_customer_lookup', 'tool:builder:read', {
              allowedAgents: ['piagent-builder'],
            }),
            tool('crm_sync_status'),
          ],
        },
      },
    ])

    const runtime = filterAppToolCatalog(catalog, {
      agentProfile: 'piagent-runtime',
      grantedPermissions: ['tool:blueprint:read'],
      entitledToolNames: ['crm_sync_status'],
    })
    expect(runtime.tools.map((item) => item.name)).toEqual([
      'erp_blueprint_list',
      'crm_sync_status',
    ])
    expect(runtime.filtered.hidden).toEqual([
      { name: 'crm_customer_lookup', reason: 'agent' },
    ])

    const builder = filterAppToolCatalog(catalog, {
      agentProfile: 'piagent-builder',
      grantedPermissions: ['tool:blueprint:read', 'tool:builder:read'],
      entitledToolNames: ['crm_customer_lookup'],
    })
    expect(builder.tools.map((item) => item.name)).toEqual([
      'erp_blueprint_list',
      'crm_customer_lookup',
    ])
    expect(builder.filtered.hidden).toEqual([
      { name: 'crm_sync_status', reason: 'entitlement' },
    ])
  })

  it('缺少用户权限 → permission 隐藏；entitled 缺省不按 entitlement 过滤', () => {
    const catalog = composeAppToolCatalog(context, [
      { kind: 'platform', label: 'platform', catalog: { version: 1, tools: [tool('erp_blueprint_list')] } },
      { kind: 'blueprint', label: 'crm', catalog: { version: 1, tools: [tool('crm_sync_status')] } },
    ])
    const result = filterAppToolCatalog(catalog, {
      agentProfile: 'piagent-runtime',
      grantedPermissions: [],
    })
    expect(result.tools).toHaveLength(0)
    expect(result.filtered.hidden).toEqual([
      { name: 'erp_blueprint_list', reason: 'permission' },
      { name: 'crm_sync_status', reason: 'permission' },
    ])
  })

  it('非法契约 → invalid，不返回部分目录', () => {
    try {
      composeAppToolCatalog(context, [
        { kind: 'blueprint', catalog: { version: 1, tools: [tool('crm_bad', 'tool:not-supported')] } },
      ])
      throw new Error('should reject')
    } catch (error) {
      expect(error).toBeInstanceOf(AppToolCatalogError)
      expect((error as AppToolCatalogError).reason).toBe('invalid')
    }
  })
})
