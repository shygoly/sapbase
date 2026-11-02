import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AgentFeedbackService } from './agent-feedback.service'

type UserLike = { id?: string; userId?: string; role?: string }

@Controller('agent')
export class AgentFeedbackController {
  constructor(private readonly feedback: AgentFeedbackService) {}

  @Post('feedback')
  @Auth()
  create(
    @Body()
    body: {
      appKey: string
      releaseId?: string
      cohort?: Record<string, unknown>
      screen?: Record<string, unknown>
      traceId?: string
      toolCallIds?: string[]
      category: string
      content?: string
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike,
  ) {
    return this.feedback.create({
      ...body,
      organizationId,
      userId: user?.id ?? user?.userId ?? 'unknown',
      role: user?.role ?? null,
    })
  }

  @Get('feedback')
  @Auth('system:manage')
  list(
    @OrganizationId() organizationId: string,
    @Query('appKey') appKey?: string,
    @Query('status') status?: string,
  ) {
    return this.feedback.list(organizationId, appKey, status)
  }

  @Get('feedback/triage')
  @Auth('system:manage')
  async triage(@OrganizationId() organizationId: string, @Query('appKey') appKey?: string) {
    return this.feedback.triage(await this.feedback.list(organizationId, appKey, 'new'))
  }
}
