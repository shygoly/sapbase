import {
  BadRequestException,
  Body,
  NotFoundException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Asset } from '@sap/platform-core/assets/asset.entity'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { ReviewComment } from './review-comment.entity'
import { ReviewDecisionService, type ReviewDecisionAction } from './review-decision.service'
import { ReviewDelegationService } from './review-delegation.service'
import { ReviewEvent } from './review-event.entity'
import { WorkItemsService } from './work-items.service'
import { ReviewReconcileJobService } from './review-reconcile-job.service'
import { ReviewCheckRegistry } from './review-check'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'

interface RuntimeUser {
  id?: string
  userId?: string
  role?: string
  roleKeys?: string[]
  positionKeys?: string[]
}

function actorOf(user: RuntimeUser | undefined) {
  const userId = user?.id ?? user?.userId ?? ''
  return {
    userId,
    roleKeys: user?.roleKeys ?? (user?.role ? [user.role] : []),
    positionKeys: user?.positionKeys ?? [],
  }
}

@ApiTags('Review & Approval')
@Controller('review')
export class ReviewController {
  constructor(
    private readonly workItems: WorkItemsService,
    private readonly decisions: ReviewDecisionService,
    private readonly delegations: ReviewDelegationService,
    private readonly reconcileJob: ReviewReconcileJobService,
    @InjectRepository(ReviewComment)
    private readonly comments: Repository<ReviewComment>,
    @InjectRepository(ReviewEvent)
    private readonly events: Repository<ReviewEvent>,
    @InjectRepository(ReviewComment)
    private readonly commentRepo: Repository<ReviewComment>,
    @InjectRepository(Asset)
    private readonly assets: Repository<Asset>,
    @InjectRepository(BlueprintApproval)
    private readonly approvals: Repository<BlueprintApproval>,
    private readonly checks: ReviewCheckRegistry,
  ) {}

  @Get('overview')
  @Auth('review:read')
  @ApiOperation({ summary: '复核运行概览：待审/超时/机器检测 provider' })
  async overview(@OrganizationId() organizationId: string) {
    const rows = await this.approvals.find({
      where: { organizationId, status: 'pending' },
      order: { dueAt: 'ASC', createdAt: 'ASC' },
    })
    const now = Date.now()
    return {
      pending: rows.length,
      overdue: rows.filter((row) => row.dueAt && row.dueAt.getTime() < now).length,
      escalated: rows.filter((row) => Boolean(row.escalatedAt)).length,
      checkSteps: rows.filter((row) => row.kind === 'check').length,
      checkProviders: this.checks.list().map((provider) => provider.name),
      sla: { scanCron: '*/10 * * * *', remindBeforeHours: 24 },
      selectors: ['role', 'user', 'position', 'creator'],
      items: rows.slice(0, 100),
    }
  }

  @Get('approvals')
  @Auth('review:read')
  @ApiOperation({ summary: '审批步骤列表（状态/记录/规则过滤）' })
  listApprovals(
    @OrganizationId() organizationId: string,
    @Query('status') status?: string,
    @Query('recordId') recordId?: string,
    @Query('ruleId') ruleId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.approvals.find({
      where: {
        organizationId,
        ...(status ? { status: status as never } : {}),
        ...(recordId ? { recordId } : {}),
        ...(ruleId ? { ruleId } : {}),
      },
      order: { createdAt: 'DESC' },
      take: Math.min(200, Math.max(1, Number(limit) || 50)),
    })
  }

  @Get('approvals/:id')
  @Auth('review:read')
  @ApiOperation({ summary: '审批详情：步骤链 + 当前轮次 + 委托' })
  async approval(@OrganizationId() organizationId: string, @Param('id') id: string) {
    const step = await this.approvals.findOne({ where: { id, organizationId } })
    if (!step) throw new NotFoundException('Approval step not found')
    const chain = await this.approvals.find({
      where: {
        organizationId,
        recordId: step.recordId,
        ruleId: step.ruleId,
      },
      order: { round: 'DESC', stepIndex: 'ASC' },
    })
    return {
      step,
      chain,
      delegations: await this.delegations.list(organizationId, id),
    }
  }

  @Get('work-items')
  @Auth('review:read')
  @ApiOperation({ summary: '通用待办（分类/未读/优先级/截止时间）' })
  listWorkItems(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Query('status') status?: string,
    @Query('sourceType') sourceType?: string,
    @Query('unread') unread?: string,
    @Query('assignee') assignee?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = user?.id ?? user?.userId
    return this.workItems.list(organizationId, {
      status: (status as never) ?? 'open',
      sourceType,
      unreadOnly: unread === 'true',
      assigneeId: assignee === 'me' ? userId : assignee,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('work-items/unread-count')
  @Auth('review:read')
  @ApiOperation({ summary: '待办未读红点' })
  async unreadCount(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Query('assignee') assignee?: string,
  ) {
    const userId = user?.id ?? user?.userId
    return {
      count: await this.workItems.unreadCount(
        organizationId,
        assignee === 'me' ? userId : assignee,
      ),
    }
  }

  @Post('work-items/:id/read')
  @Auth('review:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '标记单条待办已读' })
  readWorkItem(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    return this.workItems.markRead(organizationId, id, user?.id ?? user?.userId)
  }

  @Post('work-items/read-all')
  @Auth('review:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量标记待办已读' })
  async readAll(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    return {
      updated: await this.workItems.markAllRead(
        organizationId,
        user?.id ?? user?.userId,
      ),
    }
  }

  @Post('reconcile')
  @Auth('review:configure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重建待办并重新解析未决审批人（可重复执行）' })
  reconcile(@OrganizationId() organizationId: string) {
    return this.reconcileJob.run(organizationId)
  }

  @Get('approvals/:id/comments')
  @Auth('review:read')
  @ApiOperation({ summary: '审批评论/附件' })
  listComments(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.comments.find({
      where: { organizationId, approvalId: id },
      order: { createdAt: 'ASC' },
    })
  }

  @Post('approvals/:id/comments')
  @Auth('review:act')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '新增评论（附件必须来自已就绪 asset-pipeline 资产）' })
  async createComment(
    @OrganizationId() organizationId: string,
    @Param('id') approvalId: string,
    @Body()
    body: {
      body: string
      parentId?: string
      visibility?: 'all' | 'internal'
      attachmentAssetIds?: string[]
    },
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    const text = String(body?.body ?? '').trim()
    if (!text) throw new BadRequestException('评论正文不能为空')
    const attachments: Array<Record<string, unknown>> = []
    for (const assetId of body.attachmentAssetIds ?? []) {
      const asset = await this.assets.findOne({
        where: { id: assetId, organizationId },
      })
      if (!asset || asset.status !== 'ready') {
        throw new BadRequestException(`附件不可用（未就绪或非本组织）：${assetId}`)
      }
      attachments.push({
        assetId: asset.id,
        name: asset.originalName,
        mimeType: asset.mimeType,
        size: asset.size,
      })
    }
    const approval = await this.events.findOne({ where: { id: approvalId, organizationId } })
    const recordId = approval?.recordId ?? '00000000-0000-0000-0000-000000000000'
    return this.commentRepo.save(
      this.commentRepo.create({
        organizationId,
        approvalId,
        recordId,
        authorId: user?.id ?? user?.userId ?? null,
        body: text,
        parentId: body.parentId ?? null,
        attachments: attachments.length > 0 ? attachments : null,
        visibility: body.visibility ?? 'all',
      }),
    )
  }

  @Post('approvals/:id/resubmit')
  @Auth('review:act')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '重新提交（创建新轮次，旧轮次只读）' })
  resubmit(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() body: { comment?: string },
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    return this.decisions.resubmit(
      organizationId,
      id,
      actorOf(user),
      body?.comment,
    )
  }

  @Get('approvals/:id/events')
  @Auth('review:read')
  @ApiOperation({ summary: '审批事件（轮次/动作/委托审计）' })
  listEvents(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.events.find({
      where: { organizationId, approvalId: id },
      order: { createdAt: 'ASC' },
    })
  }

  @Post('approvals/:id/act')
  @Auth('review:act')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'approve / reject / request-changes' })
  act(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() body: { action: ReviewDecisionAction; comment?: string },
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    return this.decisions.act(
      organizationId,
      id,
      actorOf(user),
      body.action,
      body.comment,
    )
  }

  @Post('approvals/:id/delegate')
  @Auth('review:delegate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '委托当前审批给他人（记录 from/to 审计）' })
  delegate(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body()
    body: {
      toUserId: string
      reason?: string
      validFrom?: string
      validTo?: string
    },
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    const fromUserId = user?.id ?? user?.userId ?? ''
    return this.delegations.create(
      organizationId,
      id,
      fromUserId,
      body.toUserId,
      {
        reason: body.reason,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validTo: body.validTo ? new Date(body.validTo) : null,
      },
    )
  }

  @Delete('delegations/:id')
  @Auth('review:delegate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '撤销委托' })
  revokeDelegation(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.delegations.revoke(organizationId, id)
  }

  @Get('approvals/:id/delegations')
  @Auth('review:read')
  @ApiOperation({ summary: '审批委托列表' })
  listDelegations(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.delegations.list(organizationId, id)
  }
}
