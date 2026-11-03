import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { ReleaseAutomationService } from './release-automation.service'

type UserLike = { id?: string }

@Controller('release-automation')
export class ReleaseAutomationController {
  constructor(private readonly automation: ReleaseAutomationService) {}

  @Get(':appKey/policy')
  @Auth()
  policy(@Param('appKey') appKey: string, @OrganizationId() organizationId: string) {
    return this.automation.policy(organizationId, appKey)
  }

  @Post(':appKey/policy')
  @Auth('app:release:publish')
  upsert(
    @Param('appKey') appKey: string,
    @Body()
    body: {
      autonomy: 'A1' | 'A2'
      enabled: boolean
      allowedChangeClasses: string[]
      guardrails?: Record<string, unknown>
      autoRollbackEnabled?: boolean
      canaryStages?: number[]
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.automation.upsertPolicy({
      ...body,
      organizationId,
      appKey,
      reviewedBy: user?.id ?? null,
    })
  }

  @Post(':appKey/publish')
  @Auth('app:release:publish')
  publish(
    @Param('appKey') appKey: string,
    @Body()
    body: {
      changeClasses: string[]
      version: string
      manifest: Record<string, unknown>
      changelog: Record<string, unknown>
      compatibility?: Record<string, unknown>
      migrations?: Array<{ id: string; rollbackSafe?: boolean }>
    },
    @OrganizationId() organizationId: string,
  ) {
    return this.automation.publish({ ...body, organizationId, appKey })
  }

  @Post(':appKey/rollback')
  @Auth('app:release:rollback')
  rollback(
    @Param('appKey') appKey: string,
    @Body() body: { appInstallationId: string; releaseId: string; reason: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.automation.rollback({ ...body, organizationId, appKey })
  }

  @Post(':appKey/review')
  @Auth('app:release:approve')
  review(
    @Param('appKey') appKey: string,
    @Body() body: { clean: boolean },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.automation.review({
      organizationId,
      appKey,
      reviewedBy: user?.id ?? 'unknown',
      clean: body.clean,
    })
  }

  @Post(':appKey/promote')
  @Auth('app:release:activate')
  promote(
    @Param('appKey') appKey: string,
    @Body() body: { appInstallationId: string; releaseId: string },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.automation.promote({ ...body, organizationId, appKey, actorId: user?.id ?? 'unknown' })
  }

  @Get('audit/quarterly')
  @Auth('system:manage')
  audit(@OrganizationId() organizationId: string) {
    return this.automation.quarterlyAudit(organizationId)
  }

  @Post(':appKey/disable')
  @Auth('app:release:publish')
  disable(
    @Param('appKey') appKey: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.automation.disable(organizationId, appKey, user?.id ?? 'unknown')
  }
}
