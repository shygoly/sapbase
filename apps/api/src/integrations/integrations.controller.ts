import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ServiceClientAuthGuard, ServiceScopes } from '@sap/platform-core/identity/service-client-auth.guard'
import { DelegatedIdentityService } from '@sap/platform-core/identity/delegated-identity.service'
import { SemanticRuntimeService } from '../semantic-runtime/semantic-runtime.service'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import {
  IntegrationConnectorService,
  type IntegrationActor,
} from './integration-connector.service'
import { IntegrationOutboundService } from './integration-outbound.service'
import { IntegrationWebhookService } from './integration-webhook.service'
import { IntegrationDataSourceService } from './integration-data-source.service'
import { IntegrationMetricsService } from './integration-metrics.service'

interface RuntimeUser {
  id?: string
  userId?: string
  email?: string
  permissions?: string[]
}

function actorOf(user?: RuntimeUser): IntegrationActor {
  return {
    id: user?.id ?? user?.userId ?? user?.email ?? 'unknown',
    permissions: user?.permissions ?? [],
  }
}

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly connectors: IntegrationConnectorService,
    private readonly outbound: IntegrationOutboundService,
    private readonly webhooks: IntegrationWebhookService,
    private readonly dataSources: IntegrationDataSourceService,
    private readonly delegated: DelegatedIdentityService,
    private readonly runtime: SemanticRuntimeService,
    private readonly metrics: IntegrationMetricsService,
  ) {}

  @Get('connectors')
  @Auth('integrations:read')
  @ApiOperation({ summary: '连接器列表（secret 脱敏）' })
  listConnectors(@OrganizationId() organizationId: string) {
    return this.connectors.list(organizationId)
  }

  @Post('connectors')
  @Auth('integrations:manage')
  @HttpCode(HttpStatus.CREATED)
  createConnector(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.connectors.create(organizationId, actorOf(user), body as never)
  }

  @Patch('connectors/:id')
  @Auth('integrations:manage')
  updateConnector(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.connectors.update(organizationId, actorOf(user), id, body as never)
  }

  @Delete('connectors/:id')
  @Auth('integrations:manage')
  disableConnector(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.connectors.remove(organizationId, actorOf(user), id)
  }

  @Post('connectors/:id/test')
  @Auth('integrations:manage')
  @HttpCode(HttpStatus.OK)
  testConnector(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.connectors.test(organizationId, actorOf(user), id)
  }

  @Post('connectors/:id/messages')
  @Auth('integrations:manage')
  @HttpCode(HttpStatus.CREATED)
  enqueueOutbound(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Body()
    body: {
      eventType?: string
      payload?: Record<string, unknown>
      idempotencyKey?: string
    },
  ) {
    if (!body?.eventType || !body?.idempotencyKey) {
      throw new BadRequestException('eventType/idempotencyKey 必填')
    }
    return this.outbound.enqueue(organizationId, actorOf(user), {
      connectorId: id,
      eventType: body.eventType,
      payload: body.payload ?? {},
      idempotencyKey: body.idempotencyKey,
    })
  }

  @Get('outbound')
  @Auth('integrations:read')
  listOutbound(
    @OrganizationId() organizationId: string,
    @Query('status') status?: string,
  ) {
    return this.outbound.list(organizationId, status as never)
  }

  @Get('outbound/:id')
  @Auth('integrations:read')
  getOutbound(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.outbound.get(organizationId, id)
  }

  @Post('outbound/:id/replay')
  @Auth('integrations:manage')
  @HttpCode(HttpStatus.OK)
  replayOutbound(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.outbound.replay(organizationId, actorOf(user), id)
  }

  @Get('webhooks')
  @Auth('integrations:read')
  listWebhooks(@OrganizationId() organizationId: string) {
    return this.webhooks.listEndpoints(organizationId)
  }

  @Post('webhooks')
  @Auth('integrations:manage')
  @HttpCode(HttpStatus.CREATED)
  createWebhook(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.webhooks.createEndpoint(organizationId, actorOf(user), body as never)
  }

  @Delete('webhooks/:id')
  @Auth('integrations:manage')
  disableWebhook(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.webhooks.disableEndpoint(organizationId, actorOf(user), id)
  }

  @Get('webhook-events')
  @Auth('integrations:read')
  listWebhookEvents(
    @OrganizationId() organizationId: string,
    @Query('status') status?: string,
  ) {
    return this.webhooks.listEvents(organizationId, status as never)
  }

  @Post('webhook-events/:id/replay')
  @Auth('integrations:manage')
  @HttpCode(HttpStatus.OK)
  replayWebhook(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.webhooks.replay(organizationId, actorOf(user), id)
  }

  @Get('metrics')
  @Auth('integrations:read')
  @ApiOperation({ summary: '集成可观测：出站成功率/重试/DLQ、同步行数/差异' })
  integrationMetrics(@OrganizationId() organizationId: string) {
    return this.metrics.metrics(organizationId)
  }

  @Get('data-sources')
  @Auth('integrations:read')
  listSources(@OrganizationId() organizationId: string) {
    return this.dataSources.listSources(organizationId)
  }

  @Post('data-sources')
  @Auth('integrations:manage')
  @HttpCode(HttpStatus.CREATED)
  createSource(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dataSources.createSource(organizationId, actorOf(user), body as never)
  }

  @Post('data-sources/:id/test')
  @Auth('integrations:manage')
  @HttpCode(HttpStatus.OK)
  testSource(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.dataSources.testSource(organizationId, actorOf(user), id)
  }

  @Get('sync-jobs')
  @Auth('integrations:read')
  listSyncJobs(@OrganizationId() organizationId: string) {
    return this.dataSources.listJobs(organizationId)
  }

  @Post('sync-jobs')
  @Auth('integrations:manage')
  @HttpCode(HttpStatus.CREATED)
  createSyncJob(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.dataSources.createJob(organizationId, actorOf(user), body as never)
  }

  @Post('sync-jobs/:id/run')
  @Auth('integrations:manage')
  @HttpCode(HttpStatus.CREATED)
  runSyncJob(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.dataSources.runJob(organizationId, actorOf(user), id)
  }

  @Get('sync-runs')
  @Auth('integrations:read')
  listSyncRuns(
    @OrganizationId() organizationId: string,
    @Query('jobId') jobId?: string,
  ) {
    return this.dataSources.listRuns(organizationId, jobId)
  }

  @Get('external/records/:packageId/:entity')
  @UseGuards(ServiceClientAuthGuard)
  @ServiceScopes('integrations.read')
  @ApiOperation({ summary: '外部系统代用户读记录（服务端重解析权限/数据范围）' })
  async externalRecords(
    @Req() req: { organizationId?: string },
    @Param('packageId') packageId: string,
    @Param('entity') entity: string,
    @Headers('x-on-behalf-of') userId: string | undefined,
    @Query() query: Record<string, string | undefined>,
  ) {
    if (!userId) throw new BadRequestException('缺少 X-On-Behalf-Of')
    if (!req.organizationId) throw new BadRequestException('缺少组织上下文')
    const identity = await this.delegated.resolve(req.organizationId, userId)
    return this.runtime.list(packageId, entity, req.organizationId, query, {
      id: identity.userId,
      role: identity.role,
      permissions: identity.permissions,
    })
  }

  @Get('external/whoami')
  @UseGuards(ServiceClientAuthGuard)
  @ServiceScopes('integrations.read')
  @ApiOperation({ summary: '外部系统服务令牌校验（scope/组织）' })
  whoami(@Req() req: { serviceClient?: { key?: string }; organizationId?: string }) {
    return {
      organizationId: req.organizationId,
      serviceClient: req.serviceClient?.key ?? null,
      scopes: ['integrations.read'],
    }
  }
}

@ApiTags('Integrations')
@Controller('integrations/webhooks')
export class IntegrationWebhookController {
  constructor(private readonly webhooks: IntegrationWebhookService) {}

  @Post(':organizationId/:key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '入站 Webhook（HMAC/时间戳/eventId 幂等）' })
  receive(
    @Param('organizationId') organizationId: string,
    @Param('key') key: string,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-event-id') eventId: string | undefined,
    @Headers('x-event-type') eventType: string | undefined,
    @Req() req: { rawBody?: Buffer; body?: unknown; ip?: string; socket?: { remoteAddress?: string } },
  ) {
    const rawBody =
      req.rawBody ??
      Buffer.from(
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}),
        'utf8',
      )
    return this.webhooks.receive(
      organizationId,
      key,
      { signature, timestamp, eventId, eventType },
      rawBody,
      req.ip ?? req.socket?.remoteAddress,
    )
  }
}
