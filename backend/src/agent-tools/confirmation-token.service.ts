import { createHash } from 'node:crypto'
import { ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { canonicalizeJson } from '../blueprint/canonical-json'
import { AgentConfirmationToken } from './confirmation-token.entity'

/**
 * 确认令牌有效期：5 分钟。
 *
 * 短是故意的：确认必须紧贴这次写操作。拖长会让令牌变成"事后重放通道"，
 * 过期后必须重新确认（智能体不能自己续期）。
 */
export const CONFIRMATION_TOKEN_TTL_MS = 5 * 60 * 1000

const CONSUME_SQL = `
  UPDATE public.agent_confirmation_tokens
  SET "consumedAt" = now()
  WHERE id = $1
    AND "consumedAt" IS NULL
    AND "expiresAt" > now()
    AND tool = $2
    AND "argsDigest" = $3
    AND "organizationId" = $4
`

/** 参数摘要：sha256(canonicalizeJson(args))，与签发/消费共用这一份。 */
export function digestToolArgs(args: unknown): string {
  return createHash('sha256').update(canonicalizeJson(args)).digest('hex')
}

export interface IssueConfirmationInput {
  organizationId: string
  tool: string
  args: unknown
  actor: string
}

export interface ConsumeConfirmationInput {
  token: string
  organizationId: string
  tool: string
  argsDigest: string
}

@Injectable()
export class ConfirmationTokenService {
  constructor(
    @InjectRepository(AgentConfirmationToken)
    private readonly tokens: Repository<AgentConfirmationToken>,
  ) {}

  async issue(input: IssueConfirmationInput): Promise<{
    token: string
    tool: string
    argsDigest: string
    expiresAt: Date
  }> {
    const argsDigest = digestToolArgs(input.args)
    const expiresAt = new Date(Date.now() + CONFIRMATION_TOKEN_TTL_MS)
    const row = this.tokens.create({
      organizationId: input.organizationId,
      tool: input.tool,
      argsDigest,
      actor: input.actor,
      expiresAt,
      consumedAt: null,
    })
    const saved = await this.tokens.save(row)
    return {
      token: saved.id,
      tool: saved.tool,
      argsDigest: saved.argsDigest,
      expiresAt: saved.expiresAt,
    }
  }

  /**
   * 一次性消费：条件 UPDATE，影响行数 1 = 放行，0 = 拒绝。
   * 过期 / 已用 / 参数不匹配 / 工具不匹配 / 组织不匹配一律拒（fail-closed）。
   * 不要"先查后写"。
   */
  async consume(input: ConsumeConfirmationInput): Promise<void> {
    const result: unknown = await this.tokens.query(CONSUME_SQL, [
      input.token,
      input.tool,
      input.argsDigest,
      input.organizationId,
    ])
    const affected = Array.isArray(result) ? Number(result[1] ?? 0) : 0
    if (affected !== 1) {
      throw new ForbiddenException(
        '确认令牌无效或已失效（过期、已用、参数不匹配或工具不匹配一律拒绝）',
      )
    }
  }
}
