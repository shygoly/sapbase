import { BadRequestException } from '@nestjs/common'
import type { AgentToolRegistry, AgentToolInvokeInput } from '../agent-tool.registry'
import { AgentToolMcpBridge, AGENT_TOOL_TRANSPORT_ENV, assertMcpToolsSubset } from './agent-tool-mcp.bridge'
import { loadToolCatalog } from '@sap/agent-tools/contracts-loader'

function stubRegistry() {
  const invoke = jest.fn(async (input: AgentToolInvokeInput) => ({
    ok: true as const,
    tool: input.name,
    result: { echo: input.args },
  }))
  const invokeAs = jest.fn(async (_profile: string, input: AgentToolInvokeInput) => invoke(input))
  const catalog = loadToolCatalog()
  return {
    registry: { invoke, invokeAs, catalog: () => catalog } as unknown as AgentToolRegistry,
    invoke,
    invokeAs,
  }
}

describe('AgentToolMcpBridge', () => {
  const originalTransport = process.env[AGENT_TOOL_TRANSPORT_ENV]

  afterEach(() => {
    if (originalTransport === undefined) delete process.env[AGENT_TOOL_TRANSPORT_ENV]
    else process.env[AGENT_TOOL_TRANSPORT_ENV] = originalTransport
  })

  it('transport=direct 时直接委托网关，不启动 MCP', async () => {
    delete process.env[AGENT_TOOL_TRANSPORT_ENV]
    const { registry, invoke } = stubRegistry()
    const bridge = new AgentToolMcpBridge(registry)

    const result = await bridge.invoke({
      name: 'erp_blueprint_list',
      args: {},
      organizationId: 'org-1',
      actor: 'u-1',
      grantedPermissions: ['tool:blueprint:read'],
    })

    expect(invoke).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('direct 调用使用服务端 runtime profile，不接受调用方 profile', async () => {
    delete process.env[AGENT_TOOL_TRANSPORT_ENV]
    const { registry, invokeAs } = stubRegistry()
    const bridge = new AgentToolMcpBridge(registry)
    await bridge.invoke({
      name: 'erp_blueprint_list',
      args: {},
      organizationId: 'org-1',
      actor: 'u-1',
      grantedPermissions: ['tool:blueprint:read'],
    })
    expect(invokeAs).toHaveBeenCalledWith('piagent-runtime', expect.anything())
  })

  it('transport=mcp 时经 MCP 客户端调用，且上下文不被 arguments 伪造', async () => {
    process.env[AGENT_TOOL_TRANSPORT_ENV] = 'mcp'
    const { registry, invoke } = stubRegistry()
    const bridge = new AgentToolMcpBridge(registry)

    const result = await bridge.invoke({
      name: 'erp_blueprint_list',
      // 模型可能在参数里塞同名字段——不得覆盖平台上下文
      args: { organizationId: 'org-evil' } as Record<string, unknown>,
      organizationId: 'org-good',
      actor: 'u-1',
      grantedPermissions: ['tool:blueprint:read'],
    })

    expect(invoke).toHaveBeenCalledTimes(1)
    const received = invoke.mock.calls[0][0] as AgentToolInvokeInput
    expect(received.organizationId).toBe('org-good')
    expect(received.args).toEqual({ organizationId: 'org-evil' })
    expect(result).toEqual({
      ok: true,
      tool: 'erp_blueprint_list',
      result: { echo: { organizationId: 'org-evil' } },
    })
  })

  it('网关拒绝时经 MCP 回传为错误，不吞掉原因', async () => {
    process.env[AGENT_TOOL_TRANSPORT_ENV] = 'mcp'
    const registry = {
      invoke: jest.fn(),
      invokeAs: jest.fn(async () => {
        throw new BadRequestException('缺少工具权限：tool:blueprint:read')
      }),
      catalog: () => loadToolCatalog(),
    } as unknown as AgentToolRegistry
    const bridge = new AgentToolMcpBridge(registry)

    await expect(
      bridge.invoke({
        name: 'erp_blueprint_list',
        args: {},
        organizationId: 'org-1',
        actor: 'u-1',
        grantedPermissions: [],
      }),
    ).rejects.toThrow(/缺少工具权限/)
  })

  it('listTools 按 profile 收窄：runtime 看不到 builder_* 工具', async () => {
    process.env[AGENT_TOOL_TRANSPORT_ENV] = 'mcp'
    process.env.AGENT_HOST_PROFILE = 'piagent-runtime'
    const { registry } = stubRegistry()
    const bridge = new AgentToolMcpBridge(registry)

    const tools = await bridge.listTools()
    const names = tools.map((tool) => tool.name)

    expect(names).toContain('erp_blueprint_list')
    expect(names.some((name) => name.startsWith('builder_'))).toBe(false)
    delete process.env.AGENT_HOST_PROFILE
  })

  it('未知 AGENT_HOST_PROFILE → 启动失败，不静默回退 runtime', async () => {
    process.env[AGENT_TOOL_TRANSPORT_ENV] = 'mcp'
    process.env.AGENT_HOST_PROFILE = 'unknown-profile'
    const { registry } = stubRegistry()
    const bridge = new AgentToolMcpBridge(registry)
    await expect(bridge.start()).rejects.toThrow(/未知 Agent profile/)
    delete process.env.AGENT_HOST_PROFILE
  })

  it('宿主 allowlist 必须不超过网关授权集', () => {
    expect(() =>
      assertMcpToolsSubset([{ name: 'ghost_tool' }], { tools: [] }, 'piagent-runtime'),
    ).toThrow(/网关未注册工具/)
    expect(() =>
      assertMcpToolsSubset(
        [{ name: 'builder_proposal_create' }],
        { tools: [{ name: 'builder_proposal_create', allowedAgents: ['piagent-builder'] }] },
        'piagent-runtime',
      ),
    ).toThrow(/超出网关授权/)
    expect(() =>
      assertMcpToolsSubset(
        [{ name: 'erp_blueprint_list' }],
        { tools: [{ name: 'erp_blueprint_list', allowedAgents: ['piagent-runtime'] }] },
        'piagent-runtime',
      ),
    ).not.toThrow()
  })
})
