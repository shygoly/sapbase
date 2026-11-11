import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { AgentSessionsService } from '../agent-sessions/agent-sessions.service'

/**
 * Agent 长任务：job 只携带 `agentRunId` 并桥接会话事件。
 *
 * run 真源仍在 Agent Runtime（agent_turns/agent_conversations）；
 * 本任务不复制 run 状态，也不新建第二套运行表。
 */
@Injectable()
export class AgentLongTaskJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly sessions: AgentSessionsService,
  ) {}

  onModuleInit(): void {
    if (this.registry.has('agent.long_task')) return
    this.registry.register({
      type: 'agent.long_task',
      typeVersion: 1,
      timeoutMs: 10 * 60_000,
      maxAttempts: 1,
      backoff: { kind: 'fixed', baseMs: 5_000, maxMs: 5_000 },
      concurrency: 2,
      payloadSchema: {
        type: 'object',
        required: ['agentRunId', 'userId', 'message'],
        properties: {
          agentRunId: { type: 'string', minLength: 1, maxLength: 128 },
          userId: { type: 'string', minLength: 1 },
          message: { type: 'string', minLength: 1, maxLength: 20_000 },
          conversationId: { type: 'string' },
          appKey: { type: 'string' },
          appInstallationId: { type: 'string' },
          permissions: { type: 'array', items: { type: 'string' }, maxItems: 200 },
        },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => {
        if (!payload.agentRunId) throw new BadRequestException('agentRunId 必填')
        await ctx.stage('agent-running', { agentRunId: payload.agentRunId })
        const result = await this.sessions.chat({
          organizationId: ctx.organizationId,
          userId: String(payload.userId),
          actor: String(payload.userId),
          permissions: Array.isArray(payload.permissions)
            ? (payload.permissions as string[])
            : [],
          appKey: payload.appKey ? String(payload.appKey) : undefined,
          appInstallationId: payload.appInstallationId
            ? String(payload.appInstallationId)
            : undefined,
          conversationId: payload.conversationId
            ? String(payload.conversationId)
            : undefined,
          message: String(payload.message),
        })
        await ctx.progress(100, { agentRunId: payload.agentRunId })
        return {
          result: {
            agentRunId: payload.agentRunId,
            conversationId: result.conversationId,
            turnId: result.turnId,
            events: result.events,
          },
        }
      },
    })
  }
}
