import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { BlueprintReleasesService } from './blueprint-releases.service'

@ApiTags('Blueprint Releases')
@Controller('blueprint-releases')
export class BlueprintReleasesController {
  constructor(private readonly releases: BlueprintReleasesService) {}

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
