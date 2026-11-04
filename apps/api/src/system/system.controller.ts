import { Controller, Post, Body } from '@nestjs/common'
import { Auth } from '../common/decorators/auth.decorator'
import { SystemService } from './system.service'

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  /**
   * Trigger deployment of the generated system. Requires highest permission system:generate.
   * Stub: returns deployId and status; real implementation will trigger deploy pipeline.
   */
  @Post('deploy')
  @Auth('system:generate')
  async deploy(
    @Body() body: { jobId?: string; moduleId?: string },
  ): Promise<{ deployId: string; status: string }> {
    return this.systemService.deploy(body.jobId, body.moduleId)
  }
}
