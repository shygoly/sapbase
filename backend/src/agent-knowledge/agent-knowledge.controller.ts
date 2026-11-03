import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Auth } from '../common/decorators/auth.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AgentKnowledgeService } from './agent-knowledge.service'

@Controller('agent-knowledge')
export class AgentKnowledgeController {
  constructor(private readonly knowledge: AgentKnowledgeService) {}

  @Post('drafts')
  @Auth('system:manage')
  createDraft(
    @Body()
    body: {
      scope: 'global' | 'organization' | 'department' | 'user'
      scopeId?: string
      knowledgeKey: string
      title: string
      body: string
      releaseId?: string
    },
    @OrganizationId() organizationId: string,
  ) {
    return this.knowledge.createDraft({ ...body, organizationId })
  }

  @Post(':id/publish')
  @Auth('app:release:approve')
  publish(@Param('id') id: string, @Body() body: { confirmedSensitive?: boolean }, @OrganizationId() organizationId: string) {
    return this.knowledge.publish({ id, organizationId, confirmedSensitive: body?.confirmedSensitive === true })
  }

  @Get('published')
  @Auth()
  published(
    @OrganizationId() organizationId: string,
    @Query('releaseId') releaseId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.knowledge.listPublished({
      organizationId,
      releaseId: releaseId ?? null,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post(':id/rollback')
  @Auth('system:manage')
  rollback(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.knowledge.rollback({ id, organizationId })
  }

  @Post('skills')
  @Auth('system:manage')
  registerSkill(
    @Body() body: { skillKey: string; digest: string; releaseId?: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.knowledge.registerSkill({ ...body, organizationId })
  }
}
