import { BadRequestException } from '@nestjs/common'

export type AgentProfile = 'piagent-runtime' | 'piagent-builder'

const KNOWN_PROFILES: readonly AgentProfile[] = [
  'piagent-runtime',
  'piagent-builder',
]

/**
 * 可信 Agent profile 解析。
 *
 * 只接受服务端受控来源（部署环境/内部调用），绝不从请求 body 或模型参数取值。
 * 未知值直接拒绝，不静默回退 runtime。
 */
export function assertAgentProfile(profile: string): AgentProfile {
  if ((KNOWN_PROFILES as readonly string[]).includes(profile)) {
    return profile as AgentProfile
  }
  throw new BadRequestException(`未知 Agent profile：${profile}`)
}

export function resolveAgentProfile(raw?: string): AgentProfile {
  return assertAgentProfile(raw ?? 'piagent-runtime')
}
