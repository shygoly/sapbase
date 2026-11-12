import { Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'

export interface StartAgentRunInput {
  organizationId: string
  userId: string
  message: string
  conversationId?: string
  appKey?: string
  appInstallationId?: string
  screenContext?: Record<string, unknown>
  idempotencyKey?: string | null
}

export interface AgentRunView {
  jobId: string
  agentRunId: string | null
  conversationId: string | null
  status: string
  progress: number
  result: Record<string, unknown> | null
  error: Record<string, unknown> | null
  createdAt: string | null
  startedAt: string | null
  finishedAt: string | null
}

/**
 * 长时 Agent 运行的 HTTP 门面（4.8）。
 *
 * 请求只负责入队并立即返回 202；真正的模型/工具循环由 `agent.long_task`
 * worker 执行。run 状态与事件仍以 Agent Runtime 为真源，job 只做编排。
 */
@Injectable()
export class AgentRunsService {
  constructor(private readonly jobs: JobsService) {}

  async start(input: StartAgentRunInput): Promise<{
    jobId: string
    agentRunId: string
    conversationId: string | null
    status: string
    created: boolean
  }> {
    const agentRunId = randomUUID()
    const { job, created } = await this.jobs.create(
      input.organizationId,
      {
        userId: input.userId,
        // 专用入口只允许创建这一种 job；用户无需额外 jobs:manage。
        permissions: ['job:agent.long_task:create'],
      },
      {
        type: 'agent.long_task',
        payload: {
          agentRunId,
          message: input.message,
          ...(input.conversationId
            ? { conversationId: input.conversationId }
            : {}),
          ...(input.appKey ? { appKey: input.appKey } : {}),
          ...(input.appInstallationId
            ? { appInstallationId: input.appInstallationId }
            : {}),
          ...(input.screenContext ? { screenContext: input.screenContext } : {}),
        },
        idempotencyKey: input.idempotencyKey ?? null,
        appInstallationId: input.appInstallationId ?? null,
      },
    )
    return {
      jobId: job.id,
      agentRunId:
        typeof job.payload?.agentRunId === 'string'
          ? job.payload.agentRunId
          : agentRunId,
      conversationId:
        typeof job.payload?.conversationId === 'string'
          ? job.payload.conversationId
          : input.conversationId ?? null,
      status: job.status,
      created,
    }
  }

  async get(organizationId: string, jobId: string): Promise<AgentRunView> {
    const job = await this.jobs.get(organizationId, jobId)
    if (job.type !== 'agent.long_task') {
      throw new NotFoundException('Agent 运行不存在')
    }
    // job-worker 已把 handler 返回的 `result` 归一化为 job.result 本身。
    const payload = (job.result ?? null) as Record<string, unknown> | null
    const agentRunId =
      typeof payload?.agentRunId === 'string'
        ? payload.agentRunId
        : typeof job.payload?.agentRunId === 'string'
          ? job.payload.agentRunId
          : null
    const conversationId =
      typeof payload?.conversationId === 'string'
        ? payload.conversationId
        : typeof job.payload?.conversationId === 'string'
          ? job.payload.conversationId
          : null
    return {
      jobId: job.id,
      agentRunId,
      conversationId,
      status: job.status,
      progress: job.progress,
      result: payload,
      error: job.error,
      createdAt: asIso(job.createdAt),
      startedAt: asIso(job.startedAt),
      finishedAt: asIso(job.finishedAt),
    }
  }
}

function asIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}
