import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { AgentToolRegistry, type AgentToolInvokeInput } from '../agent-tool.registry'
import { resolveContractsDir } from '../contracts-loader'

/**
 * 内嵌通道（Web SSE / chat）的工具调用桥。
 *
 * 设计要点（见 openspec change `add-agent-host-and-instance-evolution`）：
 * - **工具面只有一处真源**：宿主可见的工具清单来自 `contracts/mcp-tools.json`（由契约投影生成）。
 * - **上下文不过模型**：organizationId / 权限 / 确认令牌由平台按引用传入（_meta.contextId），
 *   模型给的 arguments 里即使出现同名字段也不会被采信。
 * - **策略仍归网关**：桥只是传输，真正的契约/权限/确认/审计仍由 `AgentToolRegistry.invoke` 执行。
 *
 * 默认 transport=direct（不启用），设置 `AGENT_TOOL_TRANSPORT=mcp` 后内嵌通道改走 MCP。
 */

export const AGENT_TOOL_TRANSPORT_ENV = 'AGENT_TOOL_TRANSPORT'
export const AGENT_HOST_PROFILE_ENV = 'AGENT_HOST_PROFILE'
export const MCP_CONTEXT_META_KEY = 'sapbase/contextId'
export const MCP_MANIFEST_FILE = 'mcp-tools.json'

interface McpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: Record<string, unknown>
  _meta?: Record<string, unknown>
}

interface McpCallResult {
  isError?: boolean
  content?: Array<{ type: string; text?: string }>
  structuredContent?: unknown
}

@Injectable()
export class AgentToolMcpBridge implements OnModuleInit {
  private readonly logger = new Logger(AgentToolMcpBridge.name)
  private readonly pending = new Map<string, AgentToolInvokeInput>()
  private client?: Client
  private tools: McpToolDefinition[] = []

  constructor(private readonly registry: AgentToolRegistry) {}

  get enabled(): boolean {
    return process.env[AGENT_TOOL_TRANSPORT_ENV] === 'mcp'
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) return
    await this.start()
  }

  async start(): Promise<void> {
    if (this.client) return
    this.tools = this.loadTools()

    const server = new Server(
      { name: 'sapbase-agent-tools', version: '1.0.0' },
      { capabilities: { tools: {} } },
    )
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: this.tools }))
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const meta = (request.params as { _meta?: Record<string, unknown> })._meta
      const contextId = meta?.[MCP_CONTEXT_META_KEY]
      const context = typeof contextId === 'string' ? this.consume(contextId) : undefined
      if (!context) {
        return {
          isError: true,
          content: [{ type: 'text', text: '缺少或已失效的调用上下文' }],
        }
      }
      try {
        const result = await this.registry.invoke({
          ...context,
          name: request.params.name,
          args: (request.params.arguments ?? {}) as Record<string, unknown>,
        })
        return {
          content: [{ type: 'text', text: JSON.stringify(result.result) }],
          structuredContent: result,
        }
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
        }
      }
    })

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const client = new Client(
      { name: 'sapbase-embedded', version: '1.0.0' },
      { capabilities: {} },
    )
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    this.client = client
    this.logger.log(`工具面已切换到 MCP（${this.tools.length} 个工具）`)
  }

  /** 供测试/宿主检查当前对外暴露的工具面。 */
  async listTools(): Promise<McpToolDefinition[]> {
    if (!this.client) await this.start()
    const response = await this.client!.listTools()
    return response.tools as McpToolDefinition[]
  }

  /**
   * 调用工具。transport=direct 时直接委托网关（行为与改造前完全一致）。
   * transport=mcp 时经 MCP 客户端 → 内嵌 server → 同一个网关。
   */
  async invoke(input: AgentToolInvokeInput) {
    if (!this.enabled) return this.registry.invoke(input)
    if (!this.client) await this.start()

    const contextId = randomUUID()
    this.pending.set(contextId, input)
    try {
      const response = (await this.client!.callTool({
        name: input.name,
        arguments: input.args,
        _meta: { [MCP_CONTEXT_META_KEY]: contextId },
      })) as McpCallResult

      if (response.isError) {
        throw new BadRequestException(this.textOf(response))
      }
      if (response.structuredContent) {
        return response.structuredContent as { ok: true; tool: string; result: unknown }
      }
      return { ok: true as const, tool: input.name, result: this.textOf(response) }
    } finally {
      this.pending.delete(contextId)
    }
  }

  private consume(contextId: string): AgentToolInvokeInput | undefined {
    const context = this.pending.get(contextId)
    this.pending.delete(contextId)
    return context
  }

  private textOf(response: McpCallResult): string {
    const text = (response.content ?? [])
      .map((item) => (item.type === 'text' ? item.text ?? '' : ''))
      .join('\n')
      .trim()
    return text || '工具调用失败'
  }

  private loadTools(): McpToolDefinition[] {
    const path = join(resolveContractsDir(), MCP_MANIFEST_FILE)
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(path, 'utf8'))
    } catch (error) {
      throw new Error(
        `MCP 清单不可用（${path}）：${error instanceof Error ? error.message : String(error)}。` +
          '运行 node scripts/meta/project-mcp-tools.mjs 生成。',
      )
    }
    const tools = (raw as { tools?: unknown }).tools
    if (!Array.isArray(tools) || tools.length === 0) {
      throw new Error(`MCP 清单没有 tools（${path}）`)
    }
    return (tools as McpToolDefinition[]).filter((tool) => this.visibleToProfile(tool))
  }

  /**
   * profile 收窄：宿主只看到当前 profile 可用的工具。
   * 这是**收窄**不是授权——真正的判定仍在网关的 `assertAgent`。
   */
  private visibleToProfile(tool: McpToolDefinition): boolean {
    const allowed = tool._meta?.['sapbase/allowedAgents']
    if (!Array.isArray(allowed) || allowed.length === 0) return true
    const profile = process.env[AGENT_HOST_PROFILE_ENV] ?? 'piagent-runtime'
    return allowed.includes('*') || allowed.includes(profile)
  }
}
