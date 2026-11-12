import {
  BadRequestException,
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
import type { BusinessAppExecutionContext } from '@speckit/shared-schemas'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AppContextGuard } from './app-context.guard'
import { BusinessAppsService } from './business-apps.service'
import { CurrentApp } from './current-app.decorator'
import { InstallBusinessAppDto } from './dto/install-business-app.dto'
import { RollbackBusinessAppDto } from './dto/rollback-business-app.dto'
import { UpgradeBusinessAppDto } from './dto/upgrade-business-app.dto'

@ApiTags('Business Apps')
@Controller('apps')
export class BusinessAppsController {
  constructor(private readonly apps: BusinessAppsService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: '列出当前组织已安装的业务应用' })
  async list(@OrganizationId() organizationId: string) {
    return this.apps.listForOrganization(organizationId)
  }

  @Post('install')
  @Auth('system:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '安装已签名、已授权的 Blueprint 包为当前组织的业务应用',
  })
  async install(
    @Body() body: InstallBusinessAppDto,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: { id?: string; email?: string },
  ) {
    const saved = await this.apps.install({
      organizationId,
      packageId: body.packageId,
      userId: user.id ?? '',
      actor: user.email ?? user.id ?? 'unknown',
      deploymentProfile: body.deploymentProfile,
    })
    return this.apps.toView(saved)
  }

  @Post('backfill-default')
  @Auth('system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '把已有 Blueprint 记录的组织幂等映射到默认 ERP 安装（可 dryRun）',
  })
  async backfillDefault(
    @Body()
    body: { packageId?: string; blueprintId?: string; dryRun?: boolean },
    @OrganizationId() organizationId: string,
    @CurrentUser() user: { id?: string; email?: string },
  ) {
    if (!body?.packageId) throw new BadRequestException('packageId 必填')
    return this.apps.backfillDefaultInstallation({
      organizationId,
      packageId: body.packageId,
      blueprintId: body.blueprintId,
      userId: user.id ?? '',
      actor: user.email ?? user.id ?? 'unknown',
      dryRun: body.dryRun === true,
    })
  }

  @Get(':id/context')
  @UseGuards(JwtAuthGuard, AppContextGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '用 X-App-Id 解析当前应用的可信执行上下文' })
  context(@CurrentApp() context: BusinessAppExecutionContext) {
    return context
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: '读取当前组织内的一个应用安装' })
  async findOne(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.apps.findForOrganization(id, organizationId)
  }

  @Get(':id/revisions')
  @Auth()
  @ApiOperation({ summary: '读取应用发布修订历史' })
  async revisions(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    const revisions = await this.apps.listRevisions(id, organizationId)
    return revisions.map((revision) => this.apps.toRevisionView(revision))
  }

  @Post(':id/upgrade')
  @Auth('system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '升级应用；版本必须高于当前版本且通过 Blueprint 装载链' })
  async upgrade(
    @Param('id') id: string,
    @Body() body: UpgradeBusinessAppDto,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: { id?: string; email?: string },
  ) {
    const saved = await this.apps.upgrade({
      id,
      organizationId,
      packageId: body.packageId,
      userId: user.id ?? '',
      actor: user.email ?? user.id ?? 'unknown',
    })
    return this.apps.toView(saved)
  }

  @Post(':id/rollback')
  @Auth('system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '回滚到指定修订；未指定时回到上一修订，并重新验证发布摘要',
  })
  async rollback(
    @Param('id') id: string,
    @Body() body: RollbackBusinessAppDto,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: { id?: string; email?: string },
  ) {
    const saved = await this.apps.rollback({
      id,
      organizationId,
      revisionId: body.revisionId,
      userId: user.id ?? '',
      actor: user.email ?? user.id ?? 'unknown',
    })
    return this.apps.toView(saved)
  }

  @Post(':id/suspend')
  @Auth('system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '暂停应用；后续应用上下文解析将拒绝该应用' })
  async suspend(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: { id?: string; email?: string },
  ) {
    return this.apps.suspend(id, organizationId, user.email ?? user.id ?? 'unknown')
  }

  @Post(':id/uninstall')
  @Auth('system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '卸载应用：进入 uninstalling 并按保留期清理' })
  async uninstall(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: { id?: string; email?: string },
    @Body() body: { retentionDays?: number; purge?: boolean },
  ) {
    const saved = await this.apps.uninstall({
      id,
      organizationId,
      userId: user.id ?? '',
      actor: user.email ?? user.id ?? 'unknown',
      retentionDays: body?.retentionDays,
      purge: body?.purge,
    })
    return this.apps.toView(saved)
  }

  @Post('retention/cleanup')
  @Auth('system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '清理已到期卸载应用及修订（保留期策略）' })
  async cleanupRetention(
    @OrganizationId() organizationId: string,
  ) {
    return this.apps.cleanupRemoved(organizationId)
  }

  @Post(':id/activate')
  @Auth('system:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '恢复一个已暂停的应用' })
  async activate(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: { id?: string; email?: string },
  ) {
    return this.apps.activate(id, organizationId, user.email ?? user.id ?? 'unknown')
  }
}
