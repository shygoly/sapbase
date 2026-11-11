import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import {
  AnnouncementsService,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from './announcements.service'

interface RuntimeUser {
  id?: string
  userId?: string
}

@ApiTags('Announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @Auth('announcements:read')
  @ApiOperation({ summary: '公告列表（草稿/已发布/撤回）' })
  list(@OrganizationId() organizationId: string, @Query('status') status?: string) {
    return this.announcements.list(organizationId, status as never)
  }

  @Get(':id')
  @Auth('announcements:read')
  @ApiOperation({ summary: '公告详情' })
  get(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.announcements.get(organizationId, id)
  }

  @Post()
  @Auth('announcements:manage')
  @ApiOperation({ summary: '创建公告草稿（audience）' })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: CreateAnnouncementInput,
  ) {
    return this.announcements.create(
      organizationId,
      user?.userId ?? user?.id ?? 'anonymous',
      body,
    )
  }

  @Post(':id/copy')
  @Auth('announcements:manage')
  @ApiOperation({ summary: '复制公告为草稿（正文/受众/附件/保留期）' })
  copy(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    return this.announcements.copy(
      organizationId,
      id,
      user?.userId ?? user?.id ?? 'anonymous',
    )
  }

  @Delete(':id')
  @Auth('announcements:manage')
  @ApiOperation({ summary: '软删除草稿/已撤回/已过期公告' })
  remove(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.announcements.remove(organizationId, id)
  }

  @Patch(':id')
  @Auth('announcements:manage')
  @ApiOperation({ summary: '编辑草稿/定时公告' })
  update(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() body: UpdateAnnouncementInput,
  ) {
    return this.announcements.update(organizationId, id, body)
  }

  @Post(':id/publish')
  @Auth('announcements:publish')
  @ApiOperation({ summary: '发布：解析 audience，逐用户投递 + 通知' })
  publish(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    return this.announcements.publish(organizationId, id, { force: force === 'true' })
  }

  @Post(':id/withdraw')
  @Auth('announcements:publish')
  @ApiOperation({ summary: '撤回公告' })
  withdraw(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.announcements.withdraw(organizationId, id)
  }

  @Post(':id/read')
  @Auth('announcements:read')
  @ApiOperation({ summary: '标记公告已读（delivery）' })
  read(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user: RuntimeUser | undefined,
  ) {
    return this.announcements.markRead(
      organizationId,
      id,
      user?.userId ?? user?.id ?? '',
    )
  }

  @Get(':id/stats')
  @Auth('announcements:read')
  @ApiOperation({ summary: '公告投递/已读统计' })
  stats(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.announcements.stats(organizationId, id)
  }

  @Get(':id/deliveries')
  @Auth('announcements:read')
  @ApiOperation({ summary: '公告投递明细分页' })
  deliveries(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.announcements.deliveriesPage(organizationId, id, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      status,
    })
  }
}
