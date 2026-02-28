import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { LabWorkflowContextService } from './lab-workflow-context.service'
import { CreateLabWorkflowExecutionDto } from './dto/create-lab-workflow-execution.dto'
import { UpdateLabWorkflowStepDto } from './dto/update-lab-workflow-step.dto'

@ApiTags('Lab Workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab/workflow-executions')
export class LabWorkflowContextController {
  constructor(private readonly workflowService: LabWorkflowContextService) {}

  @Post()
  create(
    @Body() dto: CreateLabWorkflowExecutionDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.workflowService.create(dto, organizationId)
  }

  @Get('analyst/work-queue')
  getWorkQueue(@OrganizationId() organizationId: string, @CurrentUser() user: { id: string }) {
    return this.workflowService.getAnalystWorkQueue(organizationId, user.id)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.workflowService.findOne(id, organizationId)
  }

  @Post(':id/steps/complete')
  completeStep(
    @Param('id') id: string,
    @Body() dto: UpdateLabWorkflowStepDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.workflowService.completeStep(id, dto, organizationId)
  }
}
