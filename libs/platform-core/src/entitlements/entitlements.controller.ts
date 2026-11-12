import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { EntitlementsService } from './entitlements.service'
import { PLAN_CATALOG, findPlan } from './plan-catalog'
import { UsageMeteringService } from './usage-metering.service'

interface AuthedUser {
  id?: string
  userId?: string
  email?: string
}

@ApiTags('Entitlements')
@ApiBearerAuth()
@Controller('entitlements')
export class EntitlementsController {
  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly usage: UsageMeteringService,
  ) {}

  @Get('plans')
  @Auth()
  @ApiOperation({ summary: '返回计划 → 应用/配额映射（产品配置只读视图）' })
  plans() {
    return PLAN_CATALOG.map((plan) => ({
      key: plan.key,
      name: plan.name,
      apps: plan.apps,
      limits: plan.limits,
    }))
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: '读取当前组织的应用权益与本月用量汇总' })
  async overview(@OrganizationId() organizationId: string) {
    const rows = await this.entitlements.list(organizationId)
    const usage = await this.usage.summary(organizationId)
    return {
      entitlements: rows.map((row) => ({
        id: row.id,
        appKey: row.appKey,
        planName: row.planName,
        status: row.status,
        source: row.source,
        limits: row.limits,
        validFrom: row.validFrom,
        validTo: row.validTo,
      })),
      usage,
    }
  }

  @Post('sync-plan')
  @Auth('system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '按组织计划幂等物化应用权益（手工权益不覆盖）' })
  syncPlan(
    @OrganizationId() organizationId: string,
    @Body() body: { planName?: string },
    @CurrentUser() user?: AuthedUser,
  ) {
    return this.entitlements.syncPlan(
      organizationId,
      body?.planName,
      user?.id ?? user?.userId,
    )
  }

  @Get('check')
  @Auth()
  @ApiOperation({ summary: '检查某应用某指标是否在配额内（不写用量）' })
  async check(
    @OrganizationId() organizationId: string,
    @Query('appKey') appKey?: string,
    @Query('metric') metric?: string,
    @Query('amount') amount?: string,
    @Query('used') used?: string,
  ) {
    if (!appKey || !metric) {
      throw new BadRequestException('appKey/metric 必填')
    }
    return this.entitlements.checkWithinQuota({
      organizationId,
      appKey,
      metric,
      amount: amount === undefined ? 1 : Number(amount),
      used: used === undefined ? undefined : Number(used),
    })
  }

  @Post('usage')
  @Auth('system:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '记录应用用量（只追加；支持 idempotencyKey 去重）' })
  async recordUsage(
    @OrganizationId() organizationId: string,
    @Body()
    body: {
      appKey?: string
      metric?: string
      quantity?: number
      source?: string
      idempotencyKey?: string
      metadata?: Record<string, unknown> | null
    },
  ) {
    if (!body?.appKey || !body?.metric) {
      throw new BadRequestException('appKey/metric 必填')
    }
    if (!body?.source) {
      throw new BadRequestException('source 必填')
    }
    const row = await this.usage.record({
      organizationId,
      appKey: body.appKey,
      metric: body.metric,
      quantity: body.quantity ?? 0,
      source: body.source,
      idempotencyKey: body.idempotencyKey,
      metadata: body.metadata ?? null,
    })
    return {
      id: row.id,
      appKey: row.appKey,
      metric: row.metric,
      quantity: Number(row.quantity),
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      source: row.source,
      idempotencyKey: row.idempotencyKey,
    }
  }

  @Get('usage')
  @Auth()
  @ApiOperation({ summary: '读取本月用量；可按 appKey 过滤' })
  async usageSummary(
    @OrganizationId() organizationId: string,
    @Query('appKey') appKey?: string,
  ) {
    const rows = await this.usage.summary(organizationId, appKey)
    return { appKey: appKey ?? null, usage: rows }
  }

  @Get('plan')
  @Auth()
  @ApiOperation({ summary: '读取计划键/名称与配额（未知计划返回 null）' })
  plan(@Query('planName') planName?: string) {
    const plan = findPlan(planName)
    if (!plan) return { plan: null }
    return {
      plan: {
        key: plan.key,
        name: plan.name,
        apps: plan.apps,
        limits: plan.limits,
      },
    }
  }
}
