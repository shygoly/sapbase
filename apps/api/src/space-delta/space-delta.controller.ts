import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import {
  detectSpaceDeltaConflicts,
  validateSpaceDelta,
} from './space-delta.validator'

@ApiTags('Space Delta')
@Controller('space-delta')
export class SpaceDeltaController {
  @Post('validate')
  @Auth()
  @ApiOperation({ summary: '验证 space-delta/v2 声明层增量' })
  validate(@Body() body: { delta?: unknown }) {
    return validateSpaceDelta(body?.delta)
  }

  @Post('conflicts')
  @Auth()
  @ApiOperation({ summary: '确定性冲突报告（按 path/op 稳定排序）' })
  conflicts(@Body() body: { deltas?: unknown[] }) {
    const deltas = Array.isArray(body?.deltas) ? body.deltas : []
    const validations = deltas.map((delta) => validateSpaceDelta(delta))
    const valid = deltas.filter(
      (_delta, index) => validations[index]?.valid === true,
    )
    return {
      validations,
      conflicts: detectSpaceDeltaConflicts(valid as never),
    }
  }
}
