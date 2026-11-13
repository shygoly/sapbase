import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'
import { DelegatedIdentityService } from '@sap/platform-core/identity/delegated-identity.service'
import { AgentSessionsService } from '../agent-sessions/agent-sessions.service'

/**
 * Agent 长任务：job 只携带业务输入，不携带权限快照。
 *
 * - run 真源仍在 Agent Runtime（agent_turns/agent_conversations）；
 * - 用户身份来自 job.createdBy（JobsService 从可信 JWT 写入）；
 * - 执行时经 `DelegatedIdentityService` 重新解析组织成员/角色/权限，
 *   不信任入队 payload 里的 userId/permissions；
 * - 本任务不复制 run 状态，也不新建第二套运行表。
 */
@Injectable()
export class AgentLongTaskJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly jobs: JobsService,
    private readonly delegated: DelegatedIdentityService,
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
        required: ['agentRunId', 'message'],
        properties: {
          agentRunId: { type: 'string', minLength: 1, maxLength: 128 },
          message: { type: 'string', minLength: 1, maxLength: 20_000 },
          conversationId: { type: 'string' },
          appKey: { type: 'string' },
          appInstallationId: { type: 'string' },
          agentInstanceId: { type: 'string' },
          screenContext: { type: 'object' },
        },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => {
        if (!payload.agentRunId) throw new BadRequestException('agentRunId 必填')
        const job = await this.jobs.get(ctx.organizationId, ctx.jobId)
        if (!job.createdBy) {
          throw new BadRequestException('Agent 任务缺少可信创建人')
        }
        const identity = await this.delegated.resolve(
          ctx.organizationId,
          job.createdBy,
        )
        await ctx.stage('agent-running', {
          agentRunId: payload.agentRunId,
          userId: identity.userId,
        })
        const result = await this.sessions.chat({
          organizationId: ctx.organizationId,
          userId: identity.userId,
          actor: identity.userId,
          permissions: identity.permissions,
          appKey: payload.appKey ? String(payload.appKey) : undefined,
          appInstallationId: payload.appInstallationId
            ? String(payload.appInstallationId)
            : undefined,
          agentInstanceId: payload.agentInstanceId
            ? String(payload.agentInstanceId)
            : undefined,
          conversationId: payload.conversationId
            ? String(payload.conversationId)
            : undefined,
          message: String(payload.message),
          screenContext: payload.screenContext as
            | Record<string, unknown>
            | undefined,
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
