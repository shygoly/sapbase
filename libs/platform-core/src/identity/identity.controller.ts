import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AuthLoginEventsService } from './auth-login-events.service'
import { AuthSessionsService } from './auth-sessions.service'
import {
  ServiceClientsService,
  type CreateServiceClientInput,
  type UpdateServiceClientInput,
} from './service-clients.service'
import {
  IdentityProvidersService,
  type CreateIdentityProviderInput,
  type UpdateIdentityProviderInput,
} from './identity-providers.service'

@ApiTags('Identity')
@Controller('identity')
export class IdentityController {
  constructor(
    private readonly providers: IdentityProvidersService,
    private readonly sessions: AuthSessionsService,
    private readonly loginEvents: AuthLoginEventsService,
    private readonly serviceClients: ServiceClientsService,
  ) {}

  @Get('providers')
  @Auth('identity:read')
  @ApiOperation({ summary: '身份提供方列表（secret 只返回 secretRef）' })
  listProviders(@OrganizationId() organizationId: string) {
    return this.providers.list(organizationId)
  }

  @Post('providers')
  @Auth('identity:manage')
  @ApiOperation({ summary: '创建身份提供方（CAS/OAuth2/OIDC/SAML）' })
  createProvider(
    @OrganizationId() organizationId: string,
    @Body() body: CreateIdentityProviderInput,
  ) {
    return this.providers.create(organizationId, body)
  }

  @Patch('providers/:id')
  @Auth('identity:manage')
  @ApiOperation({ summary: '更新身份提供方配置/状态' })
  updateProvider(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() body: UpdateIdentityProviderInput,
  ) {
    return this.providers.update(organizationId, id, body)
  }

  @Delete('providers/:id')
  @Auth('identity:manage')
  @ApiOperation({ summary: '删除身份提供方' })
  async removeProvider(@OrganizationId() organizationId: string, @Param('id') id: string) {
    await this.providers.remove(organizationId, id)
    return { ok: true }
  }

  @Get('sessions')
  @Auth('identity:read')
  @ApiOperation({ summary: '按用户查询会话（不返回 refresh hash）' })
  listSessions(
    @OrganizationId() organizationId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId 必填')
    return this.sessions.list(organizationId, userId)
  }

  @Post('sessions/revoke')
  @Auth('identity:manage')
  @ApiOperation({ summary: '强制下线：按 sid 或按用户全部会话' })
  async revokeSessions(
    @OrganizationId() organizationId: string,
    @Body() body: { sid?: string; userId?: string; reason?: string },
  ) {
    const reason = body.reason ?? 'forced-offline'
    if (body.sid) {
      return {
        revoked: (await this.sessions.revokeScoped(organizationId, body.sid, reason)) ? 1 : 0,
      }
    }
    if (body.userId) {
      return { revoked: await this.sessions.revokeAll(organizationId, body.userId, reason) }
    }
    throw new BadRequestException('sid 或 userId 必填')
  }

  @Get('service-clients')
  @Auth('identity:read')
  @ApiOperation({ summary: '服务客户端列表（不返回 secret）' })
  listServiceClients(@OrganizationId() organizationId: string) {
    return this.serviceClients.list(organizationId)
  }

  @Post('service-clients')
  @Auth('identity:manage')
  @ApiOperation({ summary: '创建服务客户端（secret 只返回一次）' })
  createServiceClient(
    @OrganizationId() organizationId: string,
    @Body() body: CreateServiceClientInput,
  ) {
    return this.serviceClients.create(organizationId, body)
  }

  @Patch('service-clients/:id')
  @Auth('identity:manage')
  @ApiOperation({ summary: '更新服务客户端 scope/状态/白名单' })
  updateServiceClient(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() body: UpdateServiceClientInput,
  ) {
    return this.serviceClients.update(organizationId, id, body)
  }

  @Post('service-clients/:id/rotate')
  @Auth('identity:manage')
  @ApiOperation({ summary: '轮换服务客户端 secret（旧 secret 立即失效）' })
  rotateServiceClient(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.serviceClients.rotate(organizationId, id)
  }

  @Get('login-events')
  @Auth('identity:read')
  @ApiOperation({ summary: '登录事件（成功/失败）查询' })
  listLoginEvents(
    @OrganizationId() organizationId: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.loginEvents.list(organizationId, {
      userId,
      limit: limit ? Number(limit) : undefined,
    })
  }
}
