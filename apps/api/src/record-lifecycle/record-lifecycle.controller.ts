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
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { RecordLifecycleService } from './record-lifecycle.service'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'

interface RuntimeUser {
  id?: string
  email?: string
  permissions?: string[]
}

function actorOf(user?: RuntimeUser) {
  return {
    id: user?.id ?? user?.email ?? 'unknown',
    permissions: user?.permissions ?? [],
  }
}

@ApiTags('Record Lifecycle')
@Controller('blueprints/:packageId/records/:entity/:recordId')
export class RecordLifecycleController {
  constructor(
    private readonly lifecycle: RecordLifecycleService,
    private readonly jobs: JobsService,
  ) {}

  @Post('clone')
  @Auth('record:clone')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '克隆记录/子树（新 ID，幂等键可选）' })
  clone(
    @Param('packageId') packageId: string,
    @Param('entity') entity: string,
    @Param('recordId') recordId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body()
    body: {
      idempotencyKey?: string
      uniqueStrategy?: 'fail' | 'suffix' | 'placeholder'
      dataOverride?: Record<string, unknown>
    },
  ) {
    return this.lifecycle.clone({
      packageId,
      entity,
      recordId,
      organizationId,
      actor: actorOf(user),
      ...body,
    })
  }

  @Post('clone-async')
  @Auth('record:clone')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '大子树克隆：异步 job（进度/取消/重试）' })
  async cloneAsync(
    @Param('packageId') packageId: string,
    @Param('entity') entity: string,
    @Param('recordId') recordId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body()
    body: {
      idempotencyKey?: string
      uniqueStrategy?: 'fail' | 'suffix' | 'placeholder'
      dataOverride?: Record<string, unknown>
    },
  ) {
    const actor = actorOf(user)
    const { job } = await this.jobs.create(
      organizationId,
      { userId: actor.id, permissions: user?.permissions ?? [] },
      {
        type: 'record.clone',
        payload: {
          packageId,
          entity,
          recordId,
          actorId: actor.id,
          idempotencyKey: body?.idempotencyKey,
          uniqueStrategy: body?.uniqueStrategy,
          dataOverride: body?.dataOverride,
        },
      },
    )
    return { jobId: job.id, status: job.status }
  }

  @Post('move')
  @Auth('record:move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '移动树节点（防环/同树/乐观锁）' })
  move(
    @Param('packageId') packageId: string,
    @Param('entity') entity: string,
    @Param('recordId') recordId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { parentId: string | null; order?: number },
  ) {
    return this.lifecycle.move({
      packageId,
      entity,
      recordId,
      organizationId,
      actor: actorOf(user),
      parentId: body.parentId ?? null,
      order: body.order,
    })
  }

  @Post('reorder')
  @Auth('record:move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '同级排序' })
  reorder(
    @Param('packageId') packageId: string,
    @Param('entity') entity: string,
    @Param('recordId') recordId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { order: number },
  ) {
    if (typeof body?.order !== 'number') throw new BadRequestException('order 必须是数字')
    return this.lifecycle.reorder({
      packageId,
      entity,
      recordId,
      organizationId,
      actor: actorOf(user),
      order: body.order,
    })
  }

  @Post('archive')
  @Auth('record:archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '软归档（不物理删除）' })
  archive(
    @Param('packageId') packageId: string,
    @Param('entity') entity: string,
    @Param('recordId') recordId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { reason?: string; cascade?: boolean },
  ) {
    return this.lifecycle.archive({
      packageId,
      entity,
      recordId,
      organizationId,
      actor: actorOf(user),
      reason: body?.reason,
      cascade: body?.cascade,
    })
  }

  @Post('restore')
  @Auth('record:archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '恢复归档记录（父节点/唯一键校验）' })
  restore(
    @Param('packageId') packageId: string,
    @Param('entity') entity: string,
    @Param('recordId') recordId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    return this.lifecycle.restore({
      packageId,
      entity,
      recordId,
      organizationId,
      actor: actorOf(user),
    })
  }

  @Post('snapshots')
  @Auth('record:snapshot')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建版本快照' })
  snapshot(
    @Param('packageId') packageId: string,
    @Param('entity') entity: string,
    @Param('recordId') recordId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { label?: string; reason?: string },
  ) {
    return this.lifecycle.snapshot({
      packageId,
      entity,
      recordId,
      organizationId,
      actor: actorOf(user),
      label: body?.label,
      reason: body?.reason,
    })
  }

  @Get('snapshots')
  @Auth('record:snapshot')
  @ApiOperation({ summary: '快照版本列表' })
  listSnapshots(
    @Param('recordId') recordId: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.lifecycle.listSnapshots({ recordId, organizationId })
  }

  @Post('snapshots/:snapshotId/publish')
  @Auth('record:snapshot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发布快照版本（label）' })
  publishSnapshot(
    @Param('snapshotId') snapshotId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { label?: string },
  ) {
    return this.lifecycle.publishSnapshot({
      snapshotId,
      organizationId,
      actor: actorOf(user),
      label: body?.label,
    })
  }

  @Get('snapshots/diff')
  @Auth('record:snapshot')
  @ApiOperation({ summary: '字段级版本差异' })
  diff(
    @Param('recordId') recordId: string,
    @OrganizationId() organizationId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromVersion = Number(from)
    const toVersion = Number(to)
    if (!Number.isInteger(fromVersion) || !Number.isInteger(toVersion)) {
      throw new BadRequestException('from/to 必须是整数版本号')
    }
    return this.lifecycle.diff({ recordId, organizationId, fromVersion, toVersion })
  }

  @Post('snapshots/:snapshotId/restore')
  @Auth('record:snapshot')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '从旧版本恢复（创建新版本，不覆盖历史）' })
  restoreSnapshot(
    @Param('snapshotId') snapshotId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    return this.lifecycle.restoreSnapshot({
      snapshotId,
      organizationId,
      actor: actorOf(user),
    })
  }
}
