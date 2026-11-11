import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { DocumentIntelligenceService } from './document-intelligence.service'

interface RuntimeUser {
  id?: string
  email?: string
  permissions?: string[]
}

function actorOf(user?: RuntimeUser) {
  return { id: user?.id ?? user?.email ?? 'unknown', permissions: user?.permissions ?? [] }
}

@ApiTags('Document Intelligence')
@Controller('document-intelligence')
export class DocumentIntelligenceController {
  constructor(
    private readonly documents: DocumentIntelligenceService,
    private readonly jobs: JobsService,
  ) {}

  @Post('runs')
  @Auth('documents:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建解析运行并异步入队' })
  async createRun(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { assetId: string; options?: Record<string, unknown> },
  ) {
    if (!body?.assetId) throw new BadRequestException('assetId 必填')
    const actor = actorOf(user)
    const run = await this.documents.createRun(organizationId, actor, body)
    const { job } = await this.jobs.create(
      organizationId,
      { userId: actor.id, permissions: user?.permissions ?? [] },
      {
        type: 'document.intelligence.parse',
        payload: { runId: run.id },
      },
    )
    return { run, jobId: job.id }
  }

  @Get('runs')
  @Auth('documents:read')
  list(@OrganizationId() organizationId: string) {
    return this.documents.listRuns(organizationId)
  }

  @Get('runs/:id')
  @Auth('documents:read')
  @ApiOperation({ summary: '解析运行 + 章节 + 候选草案' })
  get(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.documents.getDraft(organizationId, id)
  }

  @Get('runs/:id/sections')
  @Auth('documents:read')
  sections(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.documents.getSections(organizationId, id)
  }

  @Get('runs/:id/candidates')
  @Auth('documents:read')
  candidates(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.documents.getCandidates(organizationId, id)
  }

  @Patch('candidates/:id')
  @Auth('documents:manage')
  @ApiOperation({ summary: '编辑候选（标题/正文/置信度/状态）' })
  updateCandidate(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Body()
    body: Partial<{ title: string; body: string; confidence: string; status: 'pending' | 'accepted' | 'rejected' }>,
  ) {
    return this.documents.updateCandidate(organizationId, actorOf(user), id, body)
  }

  @Post('runs/:id/candidates/confirm')
  @Auth('documents:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量确认候选（可指定 keys）' })
  confirmCandidates(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Body() body: { keys?: string[] },
  ) {
    return this.documents.confirmCandidates(organizationId, actorOf(user), id, body?.keys)
  }

  @Post('runs/:id/sections/merge')
  @Auth('documents:manage')
  @HttpCode(HttpStatus.OK)
  merge(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Body() body: { sourceKey: string; targetKey: string },
  ) {
    return this.documents.mergeSections(organizationId, actorOf(user), id, body)
  }

  @Post('runs/:id/sections/split')
  @Auth('documents:manage')
  @HttpCode(HttpStatus.CREATED)
  split(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Body() body: { sectionKey: string; at: number; title?: string },
  ) {
    return this.documents.splitSection(organizationId, actorOf(user), id, body)
  }

  @Post('runs/:id/sections/reorder')
  @Auth('documents:manage')
  @HttpCode(HttpStatus.OK)
  reorder(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Body() body: { keys: string[] },
  ) {
    if (!body?.keys?.length) throw new BadRequestException('keys 必填')
    return this.documents.reorderSections(organizationId, actorOf(user), id, body.keys)
  }

  @Post('runs/:id/confirm')
  @Auth('documents:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '确认锁定 draftVersion' })
  confirm(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.documents.confirm(organizationId, actorOf(user), id)
  }

  @Post('runs/:id/convert')
  @Auth('documents:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '声明式转换到课程/知识（幂等）' })
  convert(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Body() body: { targetResourceKey: 'knowledge' | 'course' | 'section'; packageId?: string; entity?: string },
  ) {
    if (!body?.targetResourceKey) throw new BadRequestException('targetResourceKey 必填')
    return this.documents.convert(organizationId, actorOf(user), id, body)
  }

  @Post('runs/:id/cancel')
  @Auth('documents:manage')
  @HttpCode(HttpStatus.OK)
  cancel(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.documents.cancel(organizationId, actorOf(user), id)
  }
}
