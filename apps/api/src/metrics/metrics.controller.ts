import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { MetricsService, type MetricsActor, type QueryInput } from './metrics.service'
import type { Dashboard, DashboardWidget, MetricAlert, MetricDefinition } from './metrics.entities'

interface RuntimeUser {
  id?: string
  email?: string
  permissions?: string[]
}

function actorOf(user?: RuntimeUser): MetricsActor {
  return { id: user?.id ?? user?.email ?? 'unknown', permissions: user?.permissions ?? [] }
}

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('definitions')
  @Auth('metrics:read')
  @ApiOperation({ summary: '指标定义列表（组织 + 平台内置）' })
  definitions(@OrganizationId() organizationId: string) {
    return this.metrics.listDefinitions(organizationId)
  }

  @Post('definitions')
  @Auth('metrics:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '注册指标（受控来源/聚合/维度，禁任意 SQL）' })
  createDefinition(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: Partial<MetricDefinition>,
  ) {
    return this.metrics.createDefinition(organizationId, actorOf(user), body)
  }

  @Post('query')
  @Auth('metrics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '查询指标（时间/维度/过滤/对比/范围）' })
  query(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: QueryInput,
  ) {
    if (!body?.metricKey) throw new BadRequestException('metricKey 必填')
    return this.metrics.query(organizationId, actorOf(user), body)
  }

  @Get('definitions/:key/values')
  @Auth('metrics:read')
  @ApiOperation({ summary: '指标快照值' })
  values(
    @OrganizationId() organizationId: string,
    @Param('key') key: string,
    @Query('limit') limit?: string,
  ) {
    return this.metrics.listLatestValues(organizationId, key, limit ? Number(limit) : 30)
  }

  @Post('snapshot')
  @Auth('metrics:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '立即生成日快照' })
  snapshot(@OrganizationId() organizationId: string) {
    return this.metrics.snapshotAll(organizationId)
  }

  @Post('backfill')
  @Auth('metrics:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '回填历史（同步小批量）' })
  backfill(
    @OrganizationId() organizationId: string,
    @Body() body: { metricKey?: string; days?: number },
  ) {
    return this.metrics.backfill(organizationId, {
      metricKey: body?.metricKey,
      days: body?.days ?? 30,
    })
  }

  @Get('dashboards')
  @Auth('metrics:read')
  @ApiOperation({ summary: '看板列表' })
  dashboards(@OrganizationId() organizationId: string) {
    return this.metrics.listDashboards(organizationId)
  }

  @Post('dashboards')
  @Auth('dashboards:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建看板（含 widgets，组件只引用指标）' })
  createDashboard(
    @OrganizationId() organizationId: string,
    @Body() body: Partial<Dashboard> & { widgets?: Array<Partial<DashboardWidget>> },
  ) {
    return this.metrics.createDashboard(organizationId, body)
  }

  @Get('dashboards/:key')
  @Auth('metrics:read')
  @ApiOperation({ summary: '看板 + widgets（可见性校验）' })
  dashboard(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('key') key: string,
  ) {
    return this.metrics.getDashboard(organizationId, key, actorOf(user))
  }

  @Post('dashboards/:key/query')
  @Auth('metrics:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '看板数据（每个 widget 走同一指标查询）' })
  queryDashboard(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('key') key: string,
    @Body() body: { from?: string; to?: string; compare?: QueryInput['compare'] },
  ) {
    return this.metrics.queryDashboard(organizationId, key, actorOf(user), body ?? {})
  }

  @Get('alerts')
  @Auth('alerts:manage')
  @ApiOperation({ summary: '预警规则列表' })
  alerts(@OrganizationId() organizationId: string) {
    return this.metrics.listAlerts(organizationId)
  }

  @Post('alerts')
  @Auth('alerts:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建预警（阈值/窗口/冷却/静默）' })
  createAlert(
    @OrganizationId() organizationId: string,
    @Body() body: Partial<MetricAlert>,
  ) {
    return this.metrics.createAlert(organizationId, body)
  }

  @Post('alerts/evaluate')
  @Auth('alerts:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '立即评估预警（幂等去重/恢复）' })
  evaluateAlerts(@OrganizationId() organizationId: string) {
    return this.metrics.evaluateAlerts(organizationId)
  }

  @Get('alerts/events')
  @Auth('alerts:manage')
  @ApiOperation({ summary: '预警事件列表' })
  alertEvents(
    @OrganizationId() organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.metrics.listAlertEvents(organizationId, limit ? Number(limit) : 100)
  }
}
