/**
 * 工具面客户端。写工具必须先 confirm 拿令牌，再 invoke。
 * 复用既有 httpClient，不另写 fetch 封装。
 */

import { httpClient } from './client'

export interface AgentToolCatalog {
  version: string
  tools: unknown[]
}

export interface AgentToolConfirmation {
  token: string
  tool: string
  argsDigest: string
  expiresAt: string
}

export interface AgentToolInvokeResult {
  ok: true
  tool: string
  result: unknown
}

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

class AgentToolsApi {
  async list(): Promise<AgentToolCatalog> {
    const response = await httpClient.get<unknown>('/api/agent-tools')
    return unwrap<AgentToolCatalog>(response)
  }

  async confirm(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<AgentToolConfirmation> {
    const response = await httpClient.post<unknown>(
      `/api/agent-tools/${encodeURIComponent(name)}/confirm`,
      { args },
    )
    return unwrap<AgentToolConfirmation>(response)
  }

  /**
   * 调用契约工具。confirmationToken 是必参：写工具没有令牌就不能 invoke。
   */
  async invoke(
    name: string,
    args: Record<string, unknown>,
    confirmationToken: string,
  ): Promise<AgentToolInvokeResult> {
    if (typeof confirmationToken !== 'string' || confirmationToken.trim() === '') {
      throw new Error(
        'Write tools cannot be invoked without a confirmation token',
      )
    }
    const response = await httpClient.post<unknown>(
      `/api/agent-tools/${encodeURIComponent(name)}/invoke`,
      { args, confirmationToken },
    )
    return unwrap<AgentToolInvokeResult>(response)
  }

  async confirmThenInvoke(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<AgentToolInvokeResult> {
    const confirmation = await this.confirm(name, args)
    if (typeof confirmation.token !== 'string' || confirmation.token.trim() === '') {
      throw new Error(
        'Write tools cannot be invoked without a confirmation token',
      )
    }
    return this.invoke(name, args, confirmation.token)
  }
}

export const agentToolsApi = new AgentToolsApi()
