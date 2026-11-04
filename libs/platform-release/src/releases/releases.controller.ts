import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '@sap/platform-core/common/decorators/auth.decorator'
import { CurrentUser } from '@sap/platform-core/auth/current-user.decorator'
import { OrganizationId } from '@sap/platform-core/organizations/decorators/organization-id.decorator'
import { ReleasesService } from './releases.service'
import { ReleaseIdempotencyService } from './release-idempotency.service'

type UserLike = { id?: string; email?: string; roles?: string[] }

@ApiTags('Release Builder')
@Controller('builder')
export class ReleasesBuilderController {
  constructor(
    private readonly releases: ReleasesService,
    private readonly idempotency: ReleaseIdempotencyService,
  ) {}

  @Post('apps/:appKey/drafts')
  @Auth('system:manage')
  @ApiOperation({ summary: '创建工作副本' })
  createDraft(
    @Param('appKey') appKey: string,
    @Body() body: { baseReleaseId?: string; content?: Record<string, unknown> },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.releases.createDraft({
      organizationId,
      appKey,
      baseReleaseId: body?.baseReleaseId ?? null,
      content: body?.content ?? {},
      createdBy: user?.id ?? null,
    })
  }

  @Get('apps/:appKey/drafts/:id')
  @Auth()
  getDraft(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.releases.getDraft(id, organizationId)
  }

  @Post('proposals')
  @Auth('system:manage')
  @ApiOperation({ summary: '创建变更提议（服务端硬校验证据/diff/风险/测试/回退）' })
  createProposal(
    @Body()
    body: {
      appKey: string
      draftId: string
      type: string
      areas?: string[]
      title: string
      summary: string
      diff: Record<string, unknown>
      evidence: unknown[]
      risk: Record<string, unknown>
      testPlan: Record<string, unknown>
      rollbackPlan: Record<string, unknown>
      createdByAgent?: string
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.releases.createProposal({
      ...body,
      organizationId,
      createdBy: user?.id ?? null,
      createdByAgent: body.createdByAgent ?? null,
    })
  }

  @Get('proposals')
  @Auth()
  @ApiOperation({ summary: '变更提议列表（可按应用与状态过滤）' })
  listProposals(
    @OrganizationId() organizationId: string,
    @Query('appKey') appKey?: string,
    @Query('status') status?: string,
  ) {
    return this.releases.listProposals(organizationId, appKey, status)
  }

  @Get('proposals/:id')
  @Auth()
  proposal(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.releases.getProposal(id, organizationId)
  }

  @Post('proposals/from-ai-module')
  @Auth('system:manage')
  fromAiModule(
    @Body() body: { aiModuleId: string; draftId: string },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.releases.createProposalFromAiModule({
      organizationId,
      aiModuleId: body.aiModuleId,
      draftId: body.draftId,
      createdBy: user?.id ?? null,
    })
  }

  @Post('proposals/:id/validate')
  @Auth('system:manage')
  validate(
    @Param('id') id: string,
    @Body()
    body: {
      blueprintId?: string
      previewUrl?: string
      releaseId?: string
      modelId?: string
      eval?: { suite: string; passed: number; failed: number; writeUnconfirmed?: number; previous?: { passed: number; failed: number } | null }
    },
    @OrganizationId() organizationId: string,
  ) {
    return this.releases.validateProposal(id, organizationId, body)
  }

  @Post('proposals/:id/approve')
  @Auth('app:release:approve')
  approve(
    @Param('id') id: string,
    @Body() body: { role: 'owner' | 'tech_lead' | 'security' | 'platform_admin'; comment?: string; modifiedDiff?: Record<string, unknown> },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.releases.approveProposal({
      id,
      organizationId,
      approverId: user?.id ?? user?.email ?? 'unknown',
      role: body?.role ?? 'owner',
      comment: body?.comment,
      modifiedDiff: body?.modifiedDiff,
    })
  }

  @Post('proposals/:id/reject')
  @Auth('app:release:approve')
  reject(
    @Param('id') id: string,
    @Body() body: { role: 'owner' | 'tech_lead' | 'security' | 'platform_admin'; reason: string },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.releases.rejectProposal({
      id,
      organizationId,
      approverId: user?.id ?? user?.email ?? 'unknown',
      role: body?.role ?? 'owner',
      reason: body?.reason,
    })
  }

  @Post('releases')
  @Auth('app:release:publish')
  publish(
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @Body()
    body: {
      appKey: string
      version: string
      channel: 'preview' | 'canary' | 'stable'
      manifest: Record<string, unknown>
      changelog: Record<string, unknown>
      compatibility?: Record<string, unknown>
      migrations?: Array<{ id: string; rollbackSafe?: boolean }>
      authorId?: string
      approverId?: string
      emergency?: boolean
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    if (!idempotencyKey) throw new BadRequestException('缺少 Idempotency-Key 请求头')
    return this.idempotency
      .run(`${organizationId}:publish:${idempotencyKey}`, () =>
        this.releases.publish({
          ...body,
          organizationId,
          publishedBy: user?.id ?? null,
        }),
      )
      .then((result) => ({ jobId: idempotencyKey, status: 'succeeded', result }))
  }

  @Post('releases/:id/activate')
  @Auth('app:release:activate')
  activate(
    @Param('id') id: string,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @Body() body: { appInstallationId: string; cohort?: Record<string, unknown> | null; reason?: string },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    if (!idempotencyKey) throw new BadRequestException('缺少 Idempotency-Key 请求头')
    return this.idempotency
      .run(`${organizationId}:activate:${id}:${idempotencyKey}`, () =>
        this.releases.activate({
          organizationId,
          appInstallationId: body.appInstallationId,
          releaseId: id,
          cohort: body.cohort ?? null,
          reason: body.reason ?? null,
          activatedBy: user?.id ?? null,
        }),
      )
      .then((result) => ({ jobId: idempotencyKey, status: 'succeeded', result }))
  }

  @Post('releases/:id/rollback')
  @Auth('app:release:rollback')
  rollback(
    @Param('id') id: string,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @Body() body: { appInstallationId: string; reason: string },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    if (!idempotencyKey) throw new BadRequestException('缺少 Idempotency-Key 请求头')
    return this.idempotency
      .run(`${organizationId}:rollback:${id}:${idempotencyKey}`, () =>
        this.releases.rollback({
          organizationId,
          appInstallationId: body.appInstallationId,
          releaseId: id,
          reason: body.reason,
          activatedBy: user?.id ?? null,
        }),
      )
      .then((result) => ({ jobId: idempotencyKey, status: 'succeeded', result }))
  }

  @Get('releases/:id/impact')
  @Auth()
  impact(@Param('id') id: string) {
    return this.releases.impact(id)
  }

  @Get('releases')
  @Auth()
  list(@OrganizationId() organizationId: string, @Query('appKey') appKey?: string) {
    return this.releases.listReleases(organizationId, appKey)
  }

  @Get('releases/:id')
  @Auth()
  status(@Param('id') id: string) {
    return this.releases.releaseStatus(id)
  }

  @Post('releases/:id/preview-token')
  @Auth('app:release:validate')
  previewToken(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return {
      token: this.releases.issuePreviewToken({
        userId: user?.id ?? 'unknown',
        organizationId,
        releaseId: id,
        roles: user?.roles ?? [],
      }),
    }
  }
}

@ApiTags('Release Runtime')
@Controller('apps')
export class ReleasesRuntimeController {
  constructor(private readonly releases: ReleasesService) {}

  @Get(':appKey/release')
  @Auth()
  @ApiOperation({ summary: '当前激活版本（只返回本组织 active Release）' })
  current(
    @Param('appKey') _appKey: string,
    @Query('appInstallationId') appInstallationId: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.releases.activeRelease(organizationId, appInstallationId)
  }

  @Get(':appKey/whats-new')
  @Auth()
  whatsNew(
    @Param('appKey') _appKey: string,
    @Query('appInstallationId') appInstallationId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.releases.whatsNew(organizationId, appInstallationId, user?.id ?? 'unknown')
  }

  @Post(':appKey/whats-new/:releaseId/read')
  @Auth()
  markRead(
    @Param('appKey') _appKey: string,
    @Param('releaseId') releaseId: string,
    @Body() body: { appInstallationId: string },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.releases.markWhatsNewRead({
      organizationId,
      appInstallationId: body.appInstallationId,
      userId: user?.id ?? 'unknown',
      releaseId,
    })
  }

  @Get(':appKey/preview/:token')
  @Auth()
  preview(
    @Param('token') token: string,
    @Param('appKey') _appKey: string,
    @Query('releaseId') releaseId: string | undefined,
    @OrganizationId() organizationId: string,
  ) {
    return this.releases.verifyPreviewToken(token, { organizationId, releaseId })
  }
}
