import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Sse } from '@nestjs/common'
import { Observable, from, interval, map, mergeMap, tap } from 'rxjs'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import type { JobStatus } from './job-state'
import { JobsService, type JobActor } from './jobs.service'

interface RuntimeUser {
  id?: string
  userId?: string
  permissions?: string[]
}

function actorOf(user: RuntimeUser | undefined): JobActor {
  return {
    userId: user?.userId ?? user?.id ?? 'anonymous',
    permissions: user?.permissions ?? [],
  }
}

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  @Auth()
  @ApiOperation({ summary: '创建异步任务（组织来自可信身份；幂等键可选）' })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body()
    body: {
      type: string
      typeVersion?: number
      payload?: Record<string, unknown>
      idempotencyKey?: string
      callbackUrl?: string
      callbackSecretRef?: string
      priority?: number
    },
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    if (!body?.type) throw new BadRequestException('type 必填')
    return this.jobs.create(organizationId, actorOf(user), {
      type: body.type,
      typeVersion: body.typeVersion,
      payload: body.payload ?? {},
      idempotencyKey: idempotencyHeader ?? body.idempotencyKey ?? null,
      callbackUrl: body.callbackUrl ?? null,
      callbackSecretRef: body.callbackSecretRef ?? null,
      priority: body.priority,
    })
  }

  @Get()
  @Auth('jobs:read')
  @ApiOperation({ summary: '任务列表（按组织；管理员/所有者）' })
  list(
    @OrganizationId() organizationId: string,
    @Query('status') status?: JobStatus,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.jobs.list(organizationId, {
      status,
      type,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
  }

  @Get('stats')
  @Auth('jobs:read')
  @ApiOperation({ summary: '任务积压/成功率/回调失败统计' })
  stats(@OrganizationId() organizationId: string) {
    return this.jobs.stats(organizationId)
  }

  @Get(':id')
  @Auth('jobs:read')
  @ApiOperation({ summary: '任务状态/进度/结果/错误' })
  get(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.jobs.get(organizationId, id)
  }

  @Get(':id/events')
  @Auth('jobs:read')
  @ApiOperation({ summary: '任务事件回放（afterSeq）' })
  events(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Query('afterSeq') afterSeq?: string,
  ) {
    return this.jobs.events(
      organizationId,
      id,
      afterSeq ? Math.max(0, Number(afterSeq) || 0) : 0,
    )
  }

  @Sse(':id/stream')
  @Auth('jobs:read')
  @ApiOperation({ summary: 'SSE 任务事件流（afterSeq 起；断线可重连）' })
  stream(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Query('afterSeq') afterSeq?: string,
  ): Observable<{ data: unknown }> {
    let cursor = afterSeq ? Math.max(0, Number(afterSeq) || 0) : 0
    return interval(1_000).pipe(
      mergeMap(() => from(this.jobs.events(organizationId, id, cursor))),
      tap((event) => {
        const seq = Number((event as { seq?: number }).seq ?? 0)
        if (Number.isFinite(seq)) cursor = Math.max(cursor, seq)
      }),
      map((event) => ({ data: event })),
    )
  }

  @Post(':id/cancel')
  @Auth('jobs:manage')
  @ApiOperation({ summary: '取消任务：queued/waiting 立即取消；running 协作式取消' })
  cancel(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user?: RuntimeUser,
  ) {
    return this.jobs.cancel(organizationId, id, actorOf(user))
  }

  @Post(':id/retry')
  @Auth('jobs:manage')
  @ApiOperation({ summary: 'DLQ 手动重放：dead → queued' })
  retry(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user?: RuntimeUser,
  ) {
    return this.jobs.retryDead(organizationId, id, actorOf(user))
  }

  @Post(':id/callback/replay')
  @Auth('jobs:manage')
  @ApiOperation({ summary: '手动重放回调（仍走 SSRF/签名约束）' })
  replayCallback(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user?: RuntimeUser,
  ) {
    return this.jobs.replayCallback(organizationId, id, actorOf(user))
  }
}
