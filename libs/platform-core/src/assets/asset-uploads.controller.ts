import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AssetUploadService, type InitUploadInput, type UploadPartInput } from './asset-upload.service'

interface RuntimeUser {
  id?: string
  userId?: string
}

@ApiTags('Asset Uploads')
@Controller('asset-uploads')
export class AssetUploadsController {
  constructor(private readonly uploads: AssetUploadService) {}

  @Post()
  @Auth('assets:write')
  @ApiOperation({ summary: '初始化上传会话（大小/MIME/配额校验）' })
  init(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: InitUploadInput,
  ) {
    return this.uploads.init(organizationId, user?.userId ?? user?.id ?? 'anonymous', body)
  }

  @Post('cleanup')
  @Auth('assets:write')
  @ApiOperation({ summary: '清理过期上传会话与未完成对象' })
  cleanup(@OrganizationId() organizationId: string) {
    return this.uploads.cleanupExpired(organizationId)
  }

  @Get(':id')
  @Auth('assets:read')
  @ApiOperation({ summary: '上传会话状态/已上传分片' })
  get(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.uploads.get(organizationId, id)
  }

  @Post(':id/parts')
  @Auth('assets:write')
  @ApiOperation({ summary: '记录分片（断点续传）' })
  part(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() body: UploadPartInput,
  ) {
    return this.uploads.recordPart(organizationId, id, body)
  }

  @Post(':id/complete')
  @Auth('assets:write')
  @ApiOperation({ summary: '完成上传：校验对象大小并登记资产（幂等）' })
  complete(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.uploads.complete(organizationId, id)
  }

  @Delete(':id')
  @Auth('assets:write')
  @ApiOperation({ summary: '中止上传会话' })
  abort(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.uploads.abort(organizationId, id)
  }
}
