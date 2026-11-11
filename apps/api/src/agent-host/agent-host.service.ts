import { Injectable, Logger } from '@nestjs/common'
import {
  AgentToolMcpBridge,
  AGENT_TOOL_TRANSPORT_ENV,
  AGENT_HOST_PROFILE_ENV,
} from '../agent-tools/mcp/agent-tool-mcp.bridge'

export interface AgentHostHealth {
  mode: 'embedded' | 'mcp'
  profile: string
  enabled: boolean
  healthy: boolean
  toolsCount: number
  fallback: 'web-sse'
  lastError: string | null
  checkedAt: string
}

/**
 * 宿主适配层健康检查。
 *
 * 宿主不可用时 **降级为 Web SSE**（内嵌通道），不阻塞会话：
 * - `mode=mcp` 时探测 MCP 工具面并校验 allowlist ⊆ 网关授权；
 * - 探测失败只返回 healthy=false + fallback，进程继续提供内嵌通道。
 */
@Injectable()
export class AgentHostService {
  private readonly logger = new Logger(AgentHostService.name)
  private lastError: string | null = null

  constructor(private readonly bridge: AgentToolMcpBridge) {}

  get mode(): 'embedded' | 'mcp' {
    return process.env[AGENT_TOOL_TRANSPORT_ENV] === 'mcp' ? 'mcp' : 'embedded'
  }

  async health(): Promise<AgentHostHealth> {
    const profile = process.env[AGENT_HOST_PROFILE_ENV] ?? 'piagent-runtime'
    if (this.mode === 'embedded') {
      return {
        mode: 'embedded',
        profile,
        enabled: false,
        healthy: true,
        toolsCount: 0,
        fallback: 'web-sse',
        lastError: null,
        checkedAt: new Date().toISOString(),
      }
    }
    let timer: NodeJS.Timeout | undefined
    try {
      const tools = await Promise.race([
        this.bridge.listTools(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('宿主健康检查超时')), 5_000)
        }),
      ])
      this.lastError = null
      return {
        mode: 'mcp',
        profile,
        enabled: true,
        healthy: true,
        toolsCount: tools.length,
        fallback: 'web-sse',
        lastError: null,
        checkedAt: new Date().toISOString(),
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.logger.warn(`宿主不可用，降级 Web SSE：${this.lastError}`)
      return {
        mode: 'mcp',
        profile,
        enabled: true,
        healthy: false,
        toolsCount: 0,
        fallback: 'web-sse',
        lastError: this.lastError,
        checkedAt: new Date().toISOString(),
      }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
