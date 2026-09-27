import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AgentToolRegistry } from './agent-tool.registry'

interface AuthedRequest {
  user?: {
    id?: string
    userId?: string
    email?: string
    organizationId?: string
    permissions?: string[]
  }
}

/**
 * 工具面的 HTTP 入口（给人与 C5 编排调用）。
 *
 * 守卫只用 JwtAuthGuard：工具权限是契约驱动的运行时 all-of
 * （`missingPermissions`），不要再叠 `@Auth` / `@Permissions` 的静态 any-of，
 * 两份判定并存会互相打架。
 */
@ApiTags('Agent Tools')
@Controller('agent-tools')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentToolsController {
  constructor(private readonly registry: AgentToolRegistry) {}

  @Get()
  @ApiOperation({ summary: '返回工具契约原文' })
  list() {
    return this.registry.catalog()
  }

  @Post(':name/invoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '调用契约内的工具（计算，不是创建资源）' })
  invoke(
    @Param('name') name: string,
    @Body() body: { args?: Record<string, unknown>; confirmationToken?: string },
    @Request() req: AuthedRequest,
  ) {
    return this.registry.invoke({
      name,
      args: body?.args ?? {},
      confirmationToken: body?.confirmationToken,
      organizationId: req.user?.organizationId,
      actor: req.user?.email ?? req.user?.userId ?? 'unknown',
      grantedPermissions: req.user?.permissions ?? [],
    })
  }

  @Post(':name/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '为人确认写工具签发一次性令牌' })
  confirm(
    @Param('name') name: string,
    @Body() body: { args?: Record<string, unknown> },
    @Request() req: AuthedRequest,
  ) {
    return this.registry.confirm({
      name,
      args: body?.args ?? {},
      organizationId: req.user?.organizationId,
      actor: req.user?.email ?? req.user?.userId ?? 'unknown',
    })
  }
}
