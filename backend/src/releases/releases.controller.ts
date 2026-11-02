import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { ReleasesService } from './releases.service'

type UserLike = { id?: string; email?: string; roles?: string[] }

@ApiTags('Release Builder')
@Controller('builder')
export class ReleasesBuilderController {
  constructor(private readonly releases: ReleasesService) {}

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

  @Post('proposals/:id/validate')
  @Auth('system:manage')
  validate(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.releases.validateProposal(id, organizationId)
  }

  @Post('proposals/:id/approve')
  @Auth('app:release:approve')
  approve(
    @Param('id') id: string,
    @Body() body: { role: 'owner' | 'tech_lead' | 'security' | 'platform_admin'; comment?: string },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.releases.approveProposal({
      id,
      organizationId,
      approverId: user?.id ?? user?.email ?? 'unknown',
      role: body?.role ?? 'owner',
      comment: body?.comment,
    })
  }

  @Post('releases')
  @Auth('app:release:publish')
  publish(
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
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.releases.publish({
      ...body,
      organizationId,
      publishedBy: user?.id ?? null,
    })
  }

  @Post('releases/:id/activate')
  @Auth('app:release:activate')
  activate(
    @Param('id') id: string,
    @Body() body: { appInstallationId: string; cohort?: Record<string, unknown> | null; reason?: string },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.releases.activate({
      organizationId,
      appInstallationId: body.appInstallationId,
      releaseId: id,
      cohort: body.cohort ?? null,
      reason: body.reason ?? null,
      activatedBy: user?.id ?? null,
    })
  }

  @Post('releases/:id/rollback')
  @Auth('app:release:rollback')
  rollback(
    @Param('id') id: string,
    @Body() body: { appInstallationId: string; reason: string },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.releases.rollback({
      organizationId,
      appInstallationId: body.appInstallationId,
      releaseId: id,
      reason: body.reason,
      activatedBy: user?.id ?? null,
    })
  }

  @Get('releases/:id/impact')
  @Auth()
  impact(@Param('id') id: string) {
    return this.releases.impact(id)
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
