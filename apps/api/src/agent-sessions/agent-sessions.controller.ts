import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AgentSessionsService } from './agent-sessions.service'
import { AgentRunsService } from './agent-runs.service'

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
  ) {}

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
