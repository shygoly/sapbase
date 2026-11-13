import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { BlueprintReleasesService } from './blueprint-releases.service'
import { DeploymentProfilesService } from './deployment-profiles.service'
import { SourceExportService } from './source-export.service'

@ApiTags('Blueprint Releases')
@Controller('blueprint-releases')
export class BlueprintReleasesController {
  constructor(
    private readonly releases: BlueprintReleasesService,
    private readonly profiles: DeploymentProfilesService,
    private readonly sourceExport: SourceExportService,
  ) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: '列出不可变 Blueprint release 登记' })
  list(
    @OrganizationId() organizationId: string,
    @Query('blueprintId') blueprintId?: string,
  ) {
    return this.releases.list(organizationId, blueprintId)
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: '按 id 读取 Blueprint release' })
  get(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.releases.findById(organizationId, id)
  }

  @Get(':id/profiles')
  @Auth()
  @ApiOperation({ summary: '三种交付剖面：同一 Runtime artifact 的部署/授权参数' })
  async deploymentProfiles(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    const release = await this.releases.findById(organizationId, id)
    const plans = this.profiles.plan(release)
    this.profiles.assertSameArtifact(plans)
    return { releaseId: release.id, releaseDigest: release.releaseDigest, profiles: plans }
  }

  @Post(':id/source-export')
  @Auth('system:manage')
  @ApiOperation({ summary: '可选 licensed 源码导出：只校验许可并返回计划' })
  async sourceExportPlan(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user?: { id?: string; userId?: string; email?: string },
  ) {
    const release = await this.releases.findById(organizationId, id)
    return this.sourceExport.plan(release, {
      organizationId,
      actor: user?.email ?? user?.id ?? 'system:source-export',
      requestedBy: user?.id ?? user?.userId,
    })
  }

  @Post()
  @Auth('system:manage')
  @ApiOperation({ summary: '登记不可变 Blueprint release（同版本摘要不可变）' })
  register(
    @Body()
    body: {
      blueprintId: string
      version: string
      packageId: string
      releaseDigest: string
      runtimeRequirement: string
      trustStatus?: 'verified' | 'unsigned-dev' | 'legacy'
      layers?: Record<string, unknown>
      metadata?: Record<string, unknown> | null
    },
    @OrganizationId() organizationId: string,
    @CurrentUser() user?: { id?: string; userId?: string; email?: string },
  ) {
    return this.releases.register({
      organizationId,
      ...body,
      createdById: user?.id ?? user?.userId,
      actor: user?.email ?? user?.id ?? 'system:blueprint-release',
    })
  }
}
