import { Body, Controller, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { BlueprintPublicationGateService } from './blueprint-publication-gate.service'

@ApiTags('Blueprint Publication')
@Controller('blueprints')
export class BlueprintPublicationController {
  constructor(private readonly gate: BlueprintPublicationGateService) {}

  @Post(':id/publication-gate')
  @Auth('system:manage')
  @ApiOperation({ summary: 'Blueprint 发布前评测门（injection/write/refusal）' })
  evaluate(
    @Param('id') id: string,
    @Body() body: { releaseId?: string; modelId?: string; requiredSuites?: string[] } = {},
  ) {
    return this.gate.evaluate({
      blueprintId: id,
      releaseId: body.releaseId,
      modelId: body.modelId,
      requiredSuites: body.requiredSuites,
    })
  }
}
