import { AgentHostService } from './agent-host.service'

describe('AgentHostService', () => {
  const originalTransport = process.env.AGENT_TOOL_TRANSPORT

  afterEach(() => {
    if (originalTransport === undefined) delete process.env.AGENT_TOOL_TRANSPORT
    else process.env.AGENT_TOOL_TRANSPORT = originalTransport
  })

  it('未启用 MCP 时内嵌通道健康', async () => {
    delete process.env.AGENT_TOOL_TRANSPORT
    const service = new AgentHostService({ listTools: jest.fn() } as never)
    await expect(service.health()).resolves.toMatchObject({
      mode: 'embedded',
      healthy: true,
      fallback: 'web-sse',
    })
  })

  it('MCP 可用时返回工具数', async () => {
    process.env.AGENT_TOOL_TRANSPORT = 'mcp'
    const service = new AgentHostService({
      listTools: jest.fn(async () => [{ name: 'erp_blueprint_list' }]),
    } as never)
    await expect(service.health()).resolves.toMatchObject({
      mode: 'mcp',
      enabled: true,
      healthy: true,
      toolsCount: 1,
      fallback: 'web-sse',
    })
  })

  it('MCP 不可用时降级 Web SSE，不抛错', async () => {
    process.env.AGENT_TOOL_TRANSPORT = 'mcp'
    const service = new AgentHostService({
      listTools: jest.fn(async () => {
        throw new Error('host down')
      }),
    } as never)
    await expect(service.health()).resolves.toMatchObject({
      mode: 'mcp',
      healthy: false,
      fallback: 'web-sse',
      lastError: 'host down',
    })
  })
})
