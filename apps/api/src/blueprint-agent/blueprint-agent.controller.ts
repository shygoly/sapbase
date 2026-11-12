import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { BlueprintAgentService } from './blueprint-agent.service'

interface RuntimeUser {
  id?: string
  role?: string | null
  permissions?: string[]
}

@ApiTags('Blueprint Agents')
@Controller('blueprints')
export class BlueprintAgentController {
  constructor(private readonly agents: BlueprintAgentService) {}

  @Post(':id/agents/:agentKey/run')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '运行蓝图 Agent 定义（只产出草稿；写操作需确认）' })
  run(
    @Param('id') packageId: string,
    @Param('agentKey') agentKey: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { input?: string; confirm?: boolean },
  ) {
    return this.agents.run(
      packageId,
      organizationId,
      { id: user?.id, role: user?.role ?? null, permissions: user?.permissions ?? [] },
      agentKey,
      String(body?.input ?? ''),
      body?.confirm === true,
    )
  }
}
