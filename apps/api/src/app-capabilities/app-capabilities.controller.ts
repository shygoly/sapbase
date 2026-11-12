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
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '@sap/platform-core/common/decorators/auth.decorator'
import { CurrentUser } from '@sap/platform-core/auth/current-user.decorator'
import { OrganizationId } from '@sap/platform-core/organizations/decorators/organization-id.decorator'
import type { BusinessAppExecutionContext } from '@speckit/shared-schemas'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OptionalAppContextGuard } from '../business-apps/optional-app-context.guard'
import { CurrentApp } from '../business-apps/current-app.decorator'
import { AppCapabilitiesService } from './app-capabilities.service'

type UserLike = { id?: string; userId?: string; email?: string; permissions?: string[] }

@ApiTags('App Capabilities')
@ApiBearerAuth()
@Controller('app-capabilities')
export class AppCapabilitiesController {
  constructor(private readonly capabilities: AppCapabilitiesService) {}

  @Post()
  @Auth('system:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '发布应用数据能力（显式投影/权限/owner 范围）' })
  publish(
    @Body()
    body: {
      publisherAppKey?: string
      name?: string
      entity?: string
      fields?: string[]
      permission?: string
      ownerField?: string | null
      readAllPermission?: string | null
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user?: UserLike,
  ) {
    if (!body?.publisherAppKey || !body?.name || !body?.entity || !body?.permission) {
      throw new BadRequestException('publisherAppKey/name/entity/permission 必填')
    }
    return this.capabilities.publish({
      organizationId,
      publisherAppKey: body.publisherAppKey,
      name: body.name,
      entity: body.entity,
      fields: body.fields ?? [],
      permission: body.permission,
      ownerField: body.ownerField,
      readAllPermission: body.readAllPermission,
      actor: user?.email ?? user?.id ?? 'unknown',
      actorId: user?.id ?? user?.userId,
    })
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: '列出当前组织已发布的应用能力' })
  list(
    @OrganizationId() organizationId: string,
    @Query('publisherAppKey') publisherAppKey?: string,
  ) {
    return this.capabilities.list(organizationId, publisherAppKey)
  }

  @Post(':name/invoke')
  @UseGuards(JwtAuthGuard, OptionalAppContextGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '消费方应用通过显式能力读取发布方投影' })
  invoke(
    @Param('name') name: string,
    @Body() body: { publisherAppKey?: string; limit?: number },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: UserLike | undefined,
    @CurrentApp() context?: BusinessAppExecutionContext,
  ) {
    if (!context) {
      throw new BadRequestException('缺少应用上下文（X-App-Id）')
    }
    return this.capabilities.invoke({
      organizationId,
      consumerInstallationId: context.appInstallationId,
      publisherAppKey: body?.publisherAppKey,
      name,
      userId: user?.id ?? user?.userId ?? context.userId,
      permissions: user?.permissions ?? context.grantedPermissions ?? [],
      limit: body?.limit,
    })
  }
}
