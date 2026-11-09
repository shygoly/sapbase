import { Controller, Delete, Get, Param, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AssetsService } from './assets.service'

@ApiTags('Assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @Auth('assets:read')
  @ApiOperation({ summary: '资产列表（按组织）' })
  list(
    @OrganizationId() organizationId: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.assets.list(organizationId, {
      status: status as never,
      kind: kind as never,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
  }

  @Get(':id')
  @Auth('assets:read')
  @ApiOperation({ summary: '资产详情' })
  get(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.assets.get(organizationId, id)
  }

  @Get(':id/variants')
  @Auth('assets:read')
  @ApiOperation({ summary: '资产变体（缩略图/预览/转码）' })
  variants(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.assets.listVariants(organizationId, id)
  }

  @Get(':id/download')
  @Auth('assets:read')
  @ApiOperation({ summary: '签发短时下载 URL；非 ready 拒绝' })
  download(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Query('ttl') ttl?: string,
  ) {
    return this.assets.downloadUrl(organizationId, id, ttl ? Number(ttl) : undefined)
  }

  @Delete(':id')
  @Auth('assets:write')
  @ApiOperation({ summary: '软删除资产' })
  remove(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.assets.softDelete(organizationId, id)
  }
}
