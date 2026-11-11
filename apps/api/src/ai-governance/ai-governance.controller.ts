import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AiGovernanceService } from './ai-governance.service'
import type { AiContentType, ContentLabelType } from './ai-governance.entities'

interface RuntimeUser {
  id?: string
  email?: string
  permissions?: string[]
}

function actorOf(user?: RuntimeUser) {
  return { id: user?.id ?? user?.email ?? 'unknown', permissions: user?.permissions ?? [] }
}

@ApiTags('AI Content Governance')
@Controller('ai-governance')
export class AiGovernanceController {
  constructor(private readonly governance: AiGovernanceService) {}

  @Post('provenance')
  @Auth('ai-governance:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '写入 AI 内容溯源（prompt 只存 hash）' })
  recordProvenance(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body()
    body: {
      contentId: string
      contentType: AiContentType
      producer: string
      content: string
      agent?: string
      model?: string
      prompt?: string
      templateRef?: string
      taskId?: string
      parentContentId?: string
      metadata?: Record<string, unknown>
    },
  ) {
    return this.governance.recordProvenance(organizationId, actorOf(user), body)
  }

  @Get('provenance/:contentId')
  @Auth('ai-governance:read')
  @ApiOperation({ summary: '内容溯源链（版本/父链）' })
  provenance(
    @OrganizationId() organizationId: string,
    @Param('contentId') contentId: string,
  ) {
    return this.governance.listProvenance(organizationId, contentId)
  }

  @Post('labels')
  @Auth('ai-governance:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '应用显式/隐式标识（版本化）' })
  applyLabel(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { contentId: string; labelType: ContentLabelType; text?: string },
  ) {
    if (!['explicit', 'implicit'].includes(body?.labelType)) {
      throw new BadRequestException('labelType 必须是 explicit/implicit')
    }
    return this.governance.applyLabel(organizationId, actorOf(user), body)
  }

  @Post('labels/verify')
  @Auth('ai-governance:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '校验标识是否已应用/非空' })
  verifyLabel(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { contentId: string; labelType: ContentLabelType },
  ) {
    return this.governance.verifyLabel(organizationId, actorOf(user), body)
  }

  @Get('labels/:contentId')
  @Auth('ai-governance:read')
  @ApiOperation({ summary: '内容标识列表' })
  labels(@OrganizationId() organizationId: string, @Param('contentId') contentId: string) {
    return this.governance.listLabels(organizationId, contentId)
  }

  @Post('review/submit')
  @Auth('ai-governance:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '提交终审：机器检测 → 人工 → 终审（作者不能自我终审）' })
  submitReview(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { contentId: string; text: string },
  ) {
    if (!body?.text) throw new BadRequestException('text 必填')
    return this.governance.submitForReview(organizationId, actorOf(user), body)
  }

  @Get('gate/:contentId')
  @Auth('ai-governance:read')
  @ApiOperation({ summary: '发布/导出闸：标识 + 终审状态' })
  gate(@OrganizationId() organizationId: string, @Param('contentId') contentId: string) {
    return this.governance.gate(organizationId, contentId)
  }

  @Post('scores')
  @Auth('ai-governance:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建 AI 参考分（ai_only）' })
  createScore(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body()
    body: {
      contentId?: string
      subjectType: string
      subjectId: string
      aiScore?: number
      ruleVersion?: string
      metadata?: Record<string, unknown>
    },
  ) {
    return this.governance.createScore(organizationId, actorOf(user), body)
  }

  @Get('scores')
  @Auth('ai-governance:read')
  @ApiOperation({ summary: '评分列表（学生端双值/状态）' })
  listScores(
    @OrganizationId() organizationId: string,
    @Query('subjectType') subjectType?: string,
    @Query('subjectId') subjectId?: string,
    @Query('contentId') contentId?: string,
  ) {
    return this.governance.listScores(organizationId, { subjectType, subjectId, contentId })
  }

  @Post('scores/:id/confirm')
  @Auth('ai-governance:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '教师确认/修改评分' })
  confirmScore(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Body() body: { humanScore: number },
  ) {
    if (typeof body?.humanScore !== 'number') throw new BadRequestException('humanScore 必填')
    return this.governance.confirmScore(organizationId, actorOf(user), id, body.humanScore)
  }

  @Post('scores/:id/appeal')
  @Auth('ai-governance:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '学生申诉（强制人工复核）' })
  appealScore(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    if (!body?.reason) throw new BadRequestException('reason 必填')
    return this.governance.appealScore(organizationId, actorOf(user), id, body.reason)
  }

  @Post('scores/:id/finalize')
  @Auth('ai-governance:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '终审评分（确认人不能自我终审）' })
  finalizeScore(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Param('id') id: string,
  ) {
    return this.governance.finalizeScore(organizationId, actorOf(user), id)
  }

  @Post('scores/rule-confirm')
  @Auth('ai-governance:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '确认 AI 评分规则版本' })
  confirmRule(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body() body: { subjectType: string; subjectId: string; ruleVersion: string },
  ) {
    return this.governance.confirmRule(organizationId, actorOf(user), body)
  }

  @Get('scores/rule-confirm')
  @Auth('ai-governance:read')
  @ApiOperation({ summary: '查询规则版本是否已确认' })
  hasConfirmedRule(
    @OrganizationId() organizationId: string,
    @Query('subjectType') subjectType: string,
    @Query('subjectId') subjectId: string,
    @Query('ruleVersion') ruleVersion: string,
  ) {
    return this.governance
      .hasConfirmedRule(organizationId, subjectType, subjectId, ruleVersion)
      .then((confirmed) => ({ confirmed }))
  }
}
