import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { SearchService } from './search.service'

function splitList(value?: string): string[] | undefined {
  if (!value) return undefined
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return items.length > 0 ? items : undefined
}

function parseDate(value?: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: '统一搜索（全文 + trigram 兜底，组织隔离）' })
  async query(
    @OrganizationId() organizationId: string,
    @Query('q') q?: string,
    @Query('types') types?: string,
    @Query('tags') tags?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.search.query(organizationId, {
      q,
      types: splitList(types),
      tags: splitList(tags),
      from: parseDate(from),
      to: parseDate(to),
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
  }

  @Post('reindex')
  @Auth('system:manage')
  @ApiOperation({ summary: '全量重建当前组织搜索索引（同步，可重复执行）' })
  async reindex(@OrganizationId() organizationId: string) {
    return this.search.reindexAll(organizationId)
  }

  @Post('index')
  @Auth('system:manage')
  @ApiOperation({ summary: '按资源 key/id 重建单条索引' })
  async index(
    @OrganizationId() organizationId: string,
    @Body() body: { resourceKey: string; resourceId: string },
  ) {
    return this.search.indexResource(
      organizationId,
      body.resourceKey as never,
      body.resourceId,
    )
  }
}
