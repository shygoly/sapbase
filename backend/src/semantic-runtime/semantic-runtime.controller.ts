import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { SemanticRuntimeService, toHttpException } from './semantic-runtime.service'

@ApiTags('Blueprints')
@Controller('blueprints')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SemanticRuntimeController {
  constructor(private readonly runtime: SemanticRuntimeService) {}

  @Post(':id/records/:entity')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '按已装载模板写入实体实例（fail-closed，不部分写入）' })
  async write(
    @Param('id') id: string,
    @Param('entity') entity: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user?: { organizationId?: string },
  ) {
    try {
      return await this.runtime.write(id, entity, body ?? {}, user?.organizationId ?? '')
    } catch (error) {
      toHttpException(error)
    }
  }

  @Get(':id/records/:entity')
  @ApiOperation({ summary: '按租户读回某实体的实例' })
  async list(
    @Param('id') id: string,
    @Param('entity') entity: string,
    @CurrentUser() user?: { organizationId?: string },
  ) {
    try {
      return await this.runtime.list(id, entity, user?.organizationId ?? '')
    } catch (error) {
      toHttpException(error)
    }
  }
}
