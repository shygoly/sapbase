import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  StreamableFile,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { OfflineService } from './offline.service'

interface RuntimeUser {
  id?: string
  email?: string
}

function userOf(user?: RuntimeUser): string {
  return user?.id ?? user?.email ?? 'unknown'
}

@ApiTags('Offline Content')
@Controller('offline')
export class OfflineController {
  constructor(private readonly offline: OfflineService) {}

  @Post('packages')
  @Auth('offline:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建离线包（manifest + Ed25519 签名）' })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body()
    body: {
      key: string
      title: string
      expiresAt?: string
      assets: Array<{ assetId: string; variant?: string }>
      publish?: boolean
    },
  ) {
    return this.offline.createPackage(organizationId, { id: userOf(user) }, body)
  }

  @Get('packages')
  @Auth('offline:read')
  @ApiOperation({ summary: '离线包列表' })
  list(@OrganizationId() organizationId: string) {
    return this.offline.listPackages(organizationId)
  }

  @Post('packages/:id/publish')
  @Auth('offline:manage')
  @HttpCode(HttpStatus.OK)
  publish(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.offline.publish(organizationId, { id: userOf(user) }, id)
  }

  @Post('packages/:id/revoke')
  @Auth('offline:manage')
  @HttpCode(HttpStatus.OK)
  revoke(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.offline.revokePackage(organizationId, { id: userOf(user) }, id)
  }

  @Get('packages/:id/manifest')
  @Auth('offline:read')
  @ApiOperation({ summary: '获取签名 manifest + 短期下载令牌' })
  manifest(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Query('deviceId') deviceId: string,
  ) {
    return this.offline.manifestForUser(organizationId, userOf(user), id, deviceId)
  }

  @Post('devices')
  @Auth('offline:read')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '注册离线设备（设备上限可配置）' })
  registerDevice(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { deviceId: string; name?: string },
  ) {
    return this.offline.registerDevice(organizationId, userOf(user), body)
  }

  @Get('devices')
  @Auth('offline:read')
  listDevices(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    return this.offline.listDevices(organizationId, userOf(user))
  }

  @Post('devices/:deviceId/revoke')
  @Auth('offline:manage')
  @HttpCode(HttpStatus.OK)
  revokeDevice(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('deviceId') deviceId: string,
    @Body() body: { userId: string },
  ) {
    return this.offline.revokeDevice(
      organizationId,
      { id: userOf(user) },
      body.userId,
      deviceId,
    )
  }

  @Post('packages/:id/entitlements')
  @Auth('offline:manage')
  @HttpCode(HttpStatus.CREATED)
  grant(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Body() body: { userId: string; deviceId: string; expiresAt?: string },
  ) {
    return this.offline.grantEntitlement(organizationId, { id: userOf(user) }, id, body)
  }

  @Get('entitlements')
  @Auth('offline:read')
  listEntitlements(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Query('userId') userId?: string,
  ) {
    return this.offline.listEntitlements(organizationId, userId ?? userOf(user))
  }

  @Post('entitlements/:id/revoke')
  @Auth('offline:manage')
  @HttpCode(HttpStatus.OK)
  revokeEntitlement(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.offline.revokeEntitlement(organizationId, { id: userOf(user) }, id)
  }

  @Post('entitlements/revoke')
  @Auth('offline:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '按用户/设备/包批量撤销授权' })
  revokeMany(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { userId?: string; deviceId?: string; packageId?: string },
  ) {
    return this.offline.revokeEntitlementsBy(organizationId, { id: userOf(user) }, body)
  }

  @Get('download/:token')
  @Auth('offline:read')
  @ApiOperation({ summary: '短期令牌下载（Range 由客户端按分片请求）' })
  @Header('Cache-Control', 'private, max-age=0')
  async download(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('token') token: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.offline.readDownload(organizationId, userOf(user), token)
    response.setHeader('Accept-Ranges', 'bytes')
    let buffer = file.buffer
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range)
      if (match) {
        const start = Number(match[1])
        const end = match[2] ? Number(match[2]) : file.buffer.length - 1
        if (start >= 0 && start <= end && end < file.buffer.length) {
          buffer = file.buffer.subarray(start, end + 1)
          response.status(206)
          response.setHeader('Content-Range', `bytes ${start}-${end}/${file.buffer.length}`)
        }
      }
    }
    return new StreamableFile(buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${file.filename}"`,
    })
  }

  @Post('cleanup')
  @Auth('offline:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '过期/撤销授权清理' })
  cleanup(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    return this.offline.cleanupExpired(organizationId, { id: userOf(user) })
  }
}
