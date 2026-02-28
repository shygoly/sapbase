import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { CreateLabQaSubmissionDto } from './dto/create-lab-qa-submission.dto'
import { ReviewLabQaSubmissionDto } from './dto/review-lab-qa-submission.dto'
import { QaContextService } from './qa-context.service'

@ApiTags('Lab QA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab/qa')
export class QaContextController {
  constructor(private readonly qaService: QaContextService) {}

  @Post('submissions')
  submit(
    @Body() dto: CreateLabQaSubmissionDto,
    @CurrentUser() user: { id: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.qaService.submit(dto, user.id, organizationId)
  }

  @Get('review-queue')
  getQueue(@OrganizationId() organizationId: string) {
    return this.qaService.getReviewQueue(organizationId)
  }

  @Post('reviews')
  review(
    @Body() dto: ReviewLabQaSubmissionDto,
    @CurrentUser() user: { id: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.qaService.review(dto, user.id, organizationId)
  }
}
