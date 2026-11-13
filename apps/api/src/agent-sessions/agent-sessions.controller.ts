import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AgentSessionsService } from './agent-sessions.service'
import { AgentRunsService } from './agent-runs.service'
import { AgentRuntimeService } from './agent-runtime.service'

type UserLike = {
  id?: string
  userId?: string
  email?: string
  permissions?: string[]
}

@ApiTags('PiAgent Sessions')
@Controller('agent')
export class AgentSessionsController {
  constructor(
    private readonly sessions: AgentSessionsService,
    private readonly runs: AgentRunsService,
    private readonly runtime: AgentRuntimeService,
  ) {}

  @Get('definitions')
  @Auth('system:manage')
  @ApiOperation({ summary: '列出 Agent Definition' })
  definitions(@OrganizationId() organizationId: string) {
    return this.runtime.listDefinitions(organizationId)
  }

  @Post('definitions')
  @Auth('system:manage')
  @ApiOperation({ summary: '创建 Agent Definition（draft）' })
  createDefinition(
    @Body()
    body: {
      key: string
      name: string
      role: string
      version?: number
      instructions?: string
      policy?: Record<string, unknown>
      toolScopes?: string[]
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user?: UserLike,
  ) {
    return this.runtime.createDefinition({
      organizationId,
      ...body,
      createdById: user?.id ?? user?.userId,
    })
  }

  @Post('definitions/:id/publish')
  @Auth('system:manage')
  @ApiOperation({ summary: '发布 Agent Definition' })
  publishDefinition(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.runtime.publishDefinition(organizationId, id)
  }

  @Post('instances')
  @Auth('system:manage')
  @ApiOperation({ summary: '为 app/用户绑定 Agent Instance' })
  createInstance(
    @Body()
    body: {
      appKey: string
      appInstallationId?: string
      userId: string
      definitionId: string
      profile?: 'piagent-runtime' | 'piagent-builder'
    },
    @OrganizationId() organizationId: string,
  ) {
    return this.runtime.createInstance({ organizationId, ...body })
  }

  @Post('runtime/runs')
  @Auth()
  @ApiOperation({ summary: '创建并启动 durable Agent Run' })
  startRuntimeRun(
    @Body()
    body: {
      agentInstanceId: string
      input?: Record<string, unknown>
      budget?: Record<string, unknown>
      conversationId?: string
      releaseId?: string
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user?: UserLike,
  ) {
    return this.runtime.startRun({
      organizationId,
      ...body,
      createdById: user?.id ?? user?.userId,
    })
  }

  @Get('runtime/runs/:id')
  @Auth()
  @ApiOperation({ summary: '读取 Agent Run 状态/预算/输出' })
  getRuntimeRun(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.runtime.getRun(organizationId, id)
  }

  @Get('runtime/runs/:id/events')
  @Auth()
  @ApiOperation({ summary: '按 seq 重放 Agent Run 事件' })
  runtimeEvents(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @Query('after') after?: string,
  ) {
    return this.runtime.listEvents(
      organizationId,
      id,
      after === undefined ? 0 : Number(after),
    )
  }

  @Post('runtime/runs/:id/transition')
  @Auth()
  @ApiOperation({ summary: '服务端裁决的 Agent Run 状态迁移' })
  transitionRuntimeRun(
    @Param('id') id: string,
    @Body() body: { status?: string; reason?: string },
    @OrganizationId() organizationId: string,
  ) {
    const allowed = [
      'running',
      'waiting_user',
      'waiting_external',
      'queued',
      'completed',
      'failed',
      'cancelled',
    ] as const
    const status = body?.status as (typeof allowed)[number] | undefined
    if (!status || !allowed.includes(status)) {
      throw new BadRequestException('status 非法')
    }
    return this.runtime.transition(organizationId, id, status, {
      reason: body.reason,
    })
  }

  @Post('runtime/runs/:id/wait')
  @Auth()
  @ApiOperation({ summary: '进入 waiting_user/waiting_external' })
  waitRuntimeRun(
    @Param('id') id: string,
    @Body() body: { kind: 'user' | 'external'; prompt?: string; payload?: Record<string, unknown> },
    @OrganizationId() organizationId: string,
  ) {
    return this.runtime.wait(organizationId, id, body)
  }

  @Post('runtime/runs/:id/resume')
  @Auth()
  @ApiOperation({ summary: '恢复等待中的 Agent Run' })
  resumeRuntimeRun(
    @Param('id') id: string,
    @Body() body: { resolution?: Record<string, unknown> } = {},
    @OrganizationId() organizationId: string,
  ) {
    return this.runtime.resume(organizationId, id, body.resolution ?? {})
  }

  @Post('runtime/runs/:id/complete')
  @Auth()
  @ApiOperation({ summary: '完成 Agent Run' })
  completeRuntimeRun(
    @Param('id') id: string,
    @Body() body: { output?: Record<string, unknown>; usage?: Record<string, unknown> } = {},
    @OrganizationId() organizationId: string,
  ) {
    return this.runtime.complete(
      organizationId,
      id,
      body.output ?? {},
      body.usage ?? {},
    )
  }

  @Post('runtime/runs/:id/cancel')
  @Auth()
  @ApiOperation({ summary: '取消 Agent Run' })
  cancelRuntimeRun(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.runtime.cancel(organizationId, id)
  }

  @Post('runs')
  @Auth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '入队长时 Agent 运行并立即返回 jobId（不占用 HTTP 请求）' })
  startRun(
    @Body()
    body: {
      message?: string
      conversationId?: string
      screenContext?: Record<string, unknown>
      appKey?: string
      appInstallationId?: string
      agentInstanceId?: string
      idempotencyKey?: string
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    if (typeof body?.message !== 'string' || body.message.trim().length === 0) {
      throw new BadRequestException('message 不能为空或只含空白')
    }
    return this.runs.start({
      organizationId,
      userId: user?.id ?? user?.userId ?? 'unknown',
      message: body.message,
      conversationId: body.conversationId,
      screenContext: body.screenContext,
      appKey: body.appKey,
      appInstallationId: body.appInstallationId,
      agentInstanceId: body.agentInstanceId,
      idempotencyKey: body.idempotencyKey ?? null,
    })
  }

  @Get('runs/:jobId')
  @Auth()
  @ApiOperation({ summary: '查询长时 Agent 运行的 job 状态/进度/结果' })
  run(
    @Param('jobId') jobId: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.runs.get(organizationId, jobId)
  }

  @Post('chat')
  @Auth()
  /** SSE 流的 HTTP 状态应是 200，而不是 POST 默认的 201 */
  @HttpCode(200)
  @ApiOperation({ summary: 'PiAgent 对话（SSE 事件流）' })
  async chat(
    @Body()
    body: {
      conversationId?: string
      message: string
      screenContext?: Record<string, unknown>
      appKey?: string
      appInstallationId?: string
      agentInstanceId?: string
      idempotencyKey?: string
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
    @Res() res: Response,
  ) {
    const result = await this.sessions.chat({
      organizationId,
      userId: user?.id ?? user?.userId ?? 'unknown',
      actor: user?.email ?? user?.id ?? 'unknown',
      permissions: user?.permissions ?? [],
      appKey: body.appKey,
      appInstallationId: body.appInstallationId,
      conversationId: body.conversationId,
      message: body.message,
      screenContext: body.screenContext,
      agentInstanceId: body.agentInstanceId,
      idempotencyKey: body.idempotencyKey,
    })
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Conversation-Id', result.conversationId)
    for (const event of result.events) {
      res.write(`event: ${event.type}\n`)
      res.write(`data: ${JSON.stringify(event.data)}\n\n`)
    }
    res.end()
  }

  @Get('conversations/:id')
  @Auth()
  history(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.sessions.history(organizationId, user?.id ?? user?.userId ?? 'unknown', id)
  }

  @Post('conversations/:id/cancel')
  @Auth()
  cancel(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.sessions.cancel(organizationId, user?.id ?? user?.userId ?? 'unknown', id)
  }

  @Get('health')
  health() {
    return this.sessions.health()
  }
}
