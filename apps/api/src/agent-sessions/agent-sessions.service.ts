import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash, randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'
import { compileContextEnvelope, filterKnowledge, wrapUntrustedData } from '@sap/agent-kernel'
import { AgentToolRegistry } from '../agent-tools/agent-tool.registry'
import { ChatOrchestrator } from '../chat/chat-orchestrator'
import { ReleasesService } from '../releases/releases.service'
import { AgentKnowledgeService } from '../agent-knowledge/agent-knowledge.service'
import { AgentSessionCacheService } from './agent-session-cache.service'
import { AgentConversation } from './entities/agent-conversation.entity'
import { AgentToolCall } from './entities/agent-tool-call.entity'
import { AgentTurn } from './entities/agent-turn.entity'

export interface ChatEvent {
  type: 'turn.start' | 'text.delta' | 'plan' | 'tool.start' | 'tool.result' | 'turn.end' | 'error'
  data: Record<string, unknown>
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

@Injectable()
export class AgentSessionsService {
  constructor(
    @InjectRepository(AgentConversation) private readonly conversations: Repository<AgentConversation>,
    @InjectRepository(AgentTurn) private readonly turns: Repository<AgentTurn>,
    @InjectRepository(AgentToolCall) private readonly toolCalls: Repository<AgentToolCall>,
    private readonly registry: AgentToolRegistry,
    private readonly orchestrator: ChatOrchestrator,
    private readonly releases: ReleasesService,
    private readonly knowledge: AgentKnowledgeService,
    private readonly cache: AgentSessionCacheService,
  ) {}

  async chat(input: {
    organizationId: string
    userId: string
    actor: string
    permissions: string[]
    appKey?: string
    appInstallationId?: string
    conversationId?: string
    message: string
    screenContext?: Record<string, unknown>
    idempotencyKey?: string
  }) {
    if (input.idempotencyKey) {
      const existing = await this.findIdempotentTurn(
        input.organizationId,
        input.idempotencyKey,
      )
      if (existing) return this.replayTurn(existing)
    }
    const startedAt = Date.now()
    const conversation = await this.findOrCreateConversation(input)
    const release =
      input.appInstallationId
        ? await this.releases.activeRelease(input.organizationId, input.appInstallationId)
        : null
    const catalog = this.registry.catalog()
    const publishedKnowledge = release
      ? await this.knowledge.listPublished({ organizationId: input.organizationId, releaseId: release.id })
      : await this.knowledge.listPublished({ organizationId: input.organizationId })
    const envelope = compileContextEnvelope({
      turnId: randomUUID(),
      user: { id: input.userId, roles: [] },
      org: { id: input.organizationId },
      ...(input.appKey
        ? {
            app: {
              appKey: input.appKey,
              installationId: input.appInstallationId ?? '',
              releaseId: release?.id ?? null,
              releaseVersion: release?.version,
              channel: release?.channel,
            },
          }
        : {}),
      permissions: input.permissions,
      ...(input.screenContext ? { screen: input.screenContext as never } : {}),
      knowledge: filterKnowledge(publishedKnowledge as never, {
        organizationId: input.organizationId,
        userId: input.userId,
        releaseId: release?.id ?? null,
      }),
      tools: catalog.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        write: tool.write,
        confirmation: tool.confirmation,
        permission: tool.permission,
      })),
      budget: {
        maxToolCalls: numberEnv('AGENT_MAX_TOOL_CALLS', 8),
        maxTokens: numberEnv('AGENT_MAX_TOKENS', 12_000),
        deadlineMs: numberEnv('AGENT_DEADLINE_MS', 30_000),
      },
    })

    let turn: AgentTurn
    try {
      turn = await this.turns.save(
        this.turns.create({
          organizationId: input.organizationId,
          conversationId: conversation.id,
          releaseId: release?.id ?? null,
          modelId: process.env.AGENT_MODEL_ID ?? null,
          promptHash: hash(input.message),
          contextHash: hash(envelope),
          knowledgeVersion: envelope.knowledge[0] ? `${envelope.knowledge[0].id}@${envelope.knowledge[0].version}` : null,
          status: 'running',
          idempotencyKey: input.idempotencyKey ?? null,
        }),
      )
    } catch (error) {
      if (input.idempotencyKey && (error as { code?: string }).code === '23505') {
        const existing = await this.findIdempotentTurn(
          input.organizationId,
          input.idempotencyKey,
        )
        if (existing) return this.replayTurn(existing)
      }
      throw error
    }

    const events: ChatEvent[] = [{ type: 'turn.start', data: { turnId: turn.id, releaseId: release?.id ?? null } }]
    if (await this.isTurnCancelled(turn)) {
      return this.finishCancelled(turn, conversation, events, startedAt)
    }
    try {
      const result = await this.orchestrator.handleMessage(input.message, {
        organizationId: input.organizationId,
        actor: input.actor,
        grantedPermissions: input.permissions,
        budget: envelope.budget,
      })
      if (await this.isTurnCancelled(turn)) {
        return this.finishCancelled(turn, conversation, events, startedAt)
      }
      if (result.modelId) turn.modelId = result.modelId
      if (envelope.knowledge.length > 0) {
        events.push({
          type: 'text.delta',
          data: { text: `参考知识：${envelope.knowledge.map((item) => `[kn:${item.id}@${item.version}]`).join(' ')}\n` },
        })
      }
      if (result.kind === 'refusal') {
        events.push({ type: 'text.delta', data: { text: result.message } })
      } else {
        const toolNames = result.plan.trace.tools
        for (const tool of toolNames) {
          const argsDigest = hash({})
          await this.toolCalls.save(
            this.toolCalls.create({
              organizationId: input.organizationId,
              turnId: turn.id,
              tool,
              argsDigest,
              permissionOk: true,
              confirmationId: null,
              status: 'success',
              errorCode: null,
              latencyMs: Date.now() - startedAt,
            }),
          )
          events.push({ type: 'tool.start', data: { tool, argsDigest } })
          events.push({ type: 'tool.result', data: { tool, status: 'success', summary: 'ok' } })
        }
        events.push({ type: 'plan', data: { plan: result.plan } })
      }
      turn.status = 'completed'
      turn.latencyMs = Date.now() - startedAt
      await this.turns.save(turn)
      events.push({ type: 'turn.end', data: { turnId: turn.id, usage: { latencyMs: turn.latencyMs } } })
    } catch (error) {
      if (await this.isTurnCancelled(turn)) {
        return this.finishCancelled(turn, conversation, events, startedAt)
      }
      turn.status = 'failed'
      turn.latencyMs = Date.now() - startedAt
      await this.turns.save(turn)
      events.push({ type: 'error', data: { code: 'INTERNAL', message: (error as Error).message } })
    }
    conversation.lastTurnAt = new Date()
    await this.conversations.save(conversation)
    await this.cache.remember(conversation.id, { turnId: turn.id, status: turn.status, events })
    await this.cache.rememberTurn(turn.id, {
      conversationId: conversation.id,
      turnId: turn.id,
      status: turn.status,
      events,
    })
    return { conversationId: conversation.id, turnId: turn.id, events }
  }

  private async findIdempotentTurn(
    organizationId: string,
    idempotencyKey: string,
  ): Promise<AgentTurn | null> {
    return this.turns.findOne({
      where: { organizationId, idempotencyKey },
    })
  }

  private async replayTurn(turn: AgentTurn) {
    const cached = await this.cache.recentTurn<{
      conversationId: string
      turnId: string
      status: string
      events: ChatEvent[]
    }>(turn.id)
    return {
      conversationId: turn.conversationId,
      turnId: turn.id,
      status: turn.status,
      idempotent: true,
      events:
        cached?.events ??
        [
          { type: 'turn.start', data: { turnId: turn.id } },
          { type: 'turn.end', data: { turnId: turn.id, status: turn.status } },
        ],
    }
  }

  private async isTurnCancelled(turn: AgentTurn): Promise<boolean> {
    const latest = await this.turns.findOne({
      where: { id: turn.id, organizationId: turn.organizationId },
    })
    return latest?.status === 'cancelled'
  }

  private async finishCancelled(
    turn: AgentTurn,
    conversation: AgentConversation,
    events: ChatEvent[],
    startedAt: number,
  ) {
    turn.status = 'cancelled'
    turn.latencyMs = Date.now() - startedAt
    await this.turns.save(turn)
    events.push({
      type: 'turn.end',
      data: { turnId: turn.id, status: 'cancelled', usage: { latencyMs: turn.latencyMs } },
    })
    conversation.lastTurnAt = new Date()
    await this.conversations.save(conversation)
    await this.cache.remember(conversation.id, {
      turnId: turn.id,
      status: 'cancelled',
      events,
    })
    await this.cache.rememberTurn(turn.id, {
      conversationId: conversation.id,
      turnId: turn.id,
      status: 'cancelled',
      events,
    })
    return { conversationId: conversation.id, turnId: turn.id, cancelled: true, events }
  }

  private async findOrCreateConversation(input: {
    organizationId: string
    userId: string
    appKey?: string
    appInstallationId?: string
    conversationId?: string
  }): Promise<AgentConversation> {
    if (input.conversationId) {
      const existing = await this.conversations.findOne({
        where: { id: input.conversationId, organizationId: input.organizationId, userId: input.userId },
      })
      if (!existing) throw new NotFoundException('会话不存在')
      return existing
    }
    return this.conversations.save(
      this.conversations.create({
        organizationId: input.organizationId,
        userId: input.userId,
        appKey: input.appKey ?? 'default',
        appInstallationId: input.appInstallationId ?? null,
        lastTurnAt: new Date(),
      }),
    )
  }

  async history(organizationId: string, userId: string, conversationId: string) {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId, organizationId, userId },
    })
    if (!conversation) throw new NotFoundException('会话不存在')
    const turns = await this.turns.find({ where: { conversationId }, order: { createdAt: 'ASC' } })
    const toolCalls = await this.toolCalls.find({
      where: { turnId: turns.length ? turns[turns.length - 1].id : '' },
    })
    return { conversation, turns, toolCalls }
  }

  async cancel(organizationId: string, userId: string, conversationId: string) {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId, organizationId, userId },
    })
    if (!conversation) throw new NotFoundException('会话不存在')
    const running = await this.turns.findOne({
      where: { conversationId, status: 'running' },
      order: { createdAt: 'DESC' },
    })
    if (running) {
      running.status = 'cancelled'
      await this.turns.save(running)
    }
    return { cancelled: Boolean(running) }
  }

  health() {
    return { status: 'ok', kernel: 'agent-kernel/v1' }
  }

  wrapUntrusted(content: string, source: string): string {
    return wrapUntrustedData({ content, source, nonce: randomUUID() })
  }

  /** 外部/通道内容进入本轮时标记 taint，知识写入前必须检查来源。 */
  async markTurnTainted(
    turnId: string,
    organizationId: string,
    source: string,
  ): Promise<boolean> {
    const result = await this.turns.update(
      { id: turnId, organizationId },
      { tainted: true, taintSource: source.slice(0, 128) },
    )
    return (result.affected ?? 0) > 0
  }
}
