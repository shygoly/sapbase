import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '@sap/platform-core/common/decorators/auth.decorator'
import { CurrentUser } from '@sap/platform-core/auth/current-user.decorator'
import { OrganizationId } from '@sap/platform-core/organizations/decorators/organization-id.decorator'
import { BusinessAppsService } from '../business-apps/business-apps.service'
import { AppCatalogService } from './app-catalog.service'

type UserLike = { id?: string; userId?: string; email?: string; permissions?: string[] }

@ApiTags('App Catalog')
@ApiBearerAuth()
@Controller('apps/:id/catalog')
export class AppCatalogController {
  constructor(
    private readonly catalog: AppCatalogService,
    private readonly apps: BusinessAppsService,
  ) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: '读取 active installation 的应用角色/权限/菜单/品牌/审计/用量' })
  async get(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user?: UserLike,
  ) {
    return this.catalog.getCatalog(id, organizationId, user?.permissions ?? [])
  }

  @Put('roles/:name')
  @Auth('system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建/更新应用级角色与权限' })
  async upsertRole(
    @Param('id') id: string,
    @Param('name') name: string,
    @Body()
    body: {
      permissions?: string[]
      source?: 'manual' | 'blueprint' | 'plan'
      status?: 'active' | 'inactive'
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user?: UserLike,
  ) {
    const installation = await this.apps.resolveActiveForOrganization(
      id,
      organizationId,
    )
    return this.catalog.upsertRole({
      organizationId,
      appKey: installation.appKey,
      name,
      permissions: body?.permissions ?? [],
      source: body?.source,
      status: body?.status,
      actor: user?.email ?? user?.id ?? 'unknown',
      actorId: user?.id ?? user?.userId ?? '',
    })
  }

  @Delete('roles/:name')
  @Auth('system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除应用级角色' })
  async deleteRole(
    @Param('id') id: string,
    @Param('name') name: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user?: UserLike,
  ) {
    const installation = await this.apps.resolveActiveForOrganization(
      id,
      organizationId,
    )
    await this.catalog.deleteRole({
      organizationId,
      appKey: installation.appKey,
      name,
      actor: user?.email ?? user?.id ?? 'unknown',
    })
    return { deleted: true }
  }

  @Put('branding')
  @Auth('system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '创建/更新应用级品牌配置' })
  async updateBranding(
    @Param('id') id: string,
    @Body()
    body: {
      appName?: string | null
      logoUrl?: string | null
      faviconUrl?: string | null
      theme?: Record<string, string> | null
      customCss?: string | null
      supportEmail?: string | null
      supportUrl?: string | null
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user?: UserLike,
  ) {
    const installation = await this.apps.resolveActiveForOrganization(
      id,
      organizationId,
    )
    return this.catalog.updateBranding({
      organizationId,
      appKey: installation.appKey,
      actor: user?.email ?? user?.id ?? 'unknown',
      ...body,
    })
  }
}
