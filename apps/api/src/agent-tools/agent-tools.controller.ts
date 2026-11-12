import {
  BadRequestException,
  Body,
  Optional,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AgentToolRegistry } from './agent-tool.registry'
import { OptionalAppContextGuard } from '../business-apps/optional-app-context.guard'
import { CurrentApp } from '../business-apps/current-app.decorator'
import {
  composeAppToolCatalog,
  filterAppToolCatalog,
} from '@sap/agent-tools/app-tool-catalog'
import type { BusinessAppExecutionContext } from '@speckit/shared-schemas'
import { EntitlementsService } from '@sap/platform-core/entitlements/entitlements.service'
import { UsageMeteringService } from '@sap/platform-core/entitlements/usage-metering.service'

interface AuthedRequest {
  user?: {
    id?: string
    userId?: string
    email?: string
    organizationId?: string
    permissions?: string[]
  }
  appContext?: BusinessAppExecutionContext
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
@UseGuards(JwtAuthGuard, OptionalAppContextGuard)
@ApiBearerAuth()
export class AgentToolsController {
  constructor(
    private readonly registry: AgentToolRegistry,
    @Optional() private readonly entitlements?: EntitlementsService,
    @Optional() private readonly usage?: UsageMeteringService,
  ) {}

  @Get()
  @ApiOperation({ summary: '返回工具契约原文' })
  list() {
    return this.registry.catalog()
  }

  @Get('app-catalog')
  @ApiOperation({
    summary: '组合当前应用的工具目录（平台内建 + 应用来源；重名/命名空间非法拒绝）',
  })
  appCatalog(
    @CurrentApp() context?: BusinessAppExecutionContext,
    @Request() req?: AuthedRequest,
    @Query('entitled') entitled?: string,
  ) {
    if (!context) {
      throw new BadRequestException('缺少应用上下文（X-App-Id）')
    }
    const composed = composeAppToolCatalog(context, [
      { kind: 'platform', label: 'platform', catalog: this.registry.catalog() },
    ])
    return filterAppToolCatalog(composed, {
      agentProfile: 'piagent-runtime',
      grantedPermissions: req?.user?.permissions ?? [],
      entitledToolNames: entitled
        ? entitled.split(',').map((item) => item.trim()).filter(Boolean)
        : undefined,
    })
  }

  @Post(':name/invoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '调用契约内的工具（计算，不是创建资源）' })
  async invoke(
    @Param('name') name: string,
    @Body() body: { args?: Record<string, unknown>; confirmationToken?: string },
    @Request() req: AuthedRequest,
  ) {
    const organizationId = req.user?.organizationId
    const appKey = req.appContext?.appKey
    let metered = false
    if (organizationId && appKey && this.entitlements) {
      const entitlement = await this.entitlements.findActive(organizationId, appKey)
      if (entitlement) {
        await this.entitlements.assertWithinQuota({
          organizationId,
          appKey,
          metric: 'maxMonthlyToolCalls',
          amount: 1,
          entitlement,
        })
        metered = true
      }
    }
    const result = await this.registry.invoke({
      name,
      args: body?.args ?? {},
      confirmationToken: body?.confirmationToken,
      organizationId,
      actor: req.user?.email ?? req.user?.userId ?? 'unknown',
      grantedPermissions: req.user?.permissions ?? [],
      appContext: req.appContext,
    })
    if (metered && organizationId && appKey && this.usage) {
      await this.usage.record({
        organizationId,
        appKey,
        metric: 'maxMonthlyToolCalls',
        quantity: 1,
        source: 'agent-tools',
      })
    }
    return result
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
      appContext: req.appContext,
    })
  }
}
