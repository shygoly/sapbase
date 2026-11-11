import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { AgentHostService } from './agent-host.service'

@ApiTags('Agent Host')
@Controller('agent-host')
export class AgentHostController {
  constructor(private readonly host: AgentHostService) {}

  @Get('health')
  @Auth()
  @ApiOperation({ summary: '宿主适配层健康（不可用时降级 Web SSE）' })
  health() {
    return this.host.health()
  }
}
