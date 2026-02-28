import { Body, Controller, Get, Header, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { LabWorkflowContextService } from '../lab-workflow-context/lab-workflow-context.service'
import { UpdateLabWorkflowStepDto } from '../lab-workflow-context/dto/update-lab-workflow-step.dto'
import { CreateLabWorkflowExecutionDto } from '../lab-workflow-context/dto/create-lab-workflow-execution.dto'
import { MethodContextService } from '../method-context/method-context.service'
import { CreateLabMethodDto } from '../method-context/dto/create-lab-method.dto'
import { CreateLabMethodVersionDto } from '../method-context/dto/create-lab-method-version.dto'
import { UpdateLabMethodDto } from '../method-context/dto/update-lab-method.dto'
import { CreateLabQaSubmissionDto } from '../qa-context/dto/create-lab-qa-submission.dto'
import { ReviewLabQaSubmissionDto } from '../qa-context/dto/review-lab-qa-submission.dto'
import { QaContextService } from '../qa-context/qa-context.service'
import { CreateLabSampleDto } from '../sample-context/dto/create-lab-sample.dto'
import { UpdateLabSampleDto } from '../sample-context/dto/update-lab-sample.dto'
import { LabSampleStatus } from '../sample-context/lab-sample.entity'
import { SampleContextService } from '../sample-context/sample-context.service'
import { ReportContextService } from '../report-context/report-context.service'
import { CreateLabReportDto } from '../report-context/dto/create-lab-report.dto'
import { GenerateLabReportDto } from '../report-context/dto/generate-lab-report.dto'
import { LabReportStatus } from '../report-context/lab-report.entity'
import { AuditContextService } from '../audit-context/audit-context.service'
import { QueryLabAuditLogDto } from '../audit-context/dto/query-lab-audit-log.dto'
import { CreateLabAuditLogDto } from '../audit-context/dto/create-lab-audit-log.dto'

class CompatAssignMethodDto {
  @IsUUID()
  assignedMethodId: string

  @IsOptional()
  @IsUUID()
  assignedAnalystId?: string
}

class CompatStatusDto {
  @IsEnum(LabSampleStatus)
  status: LabSampleStatus
}

class CompatWorkQueueQueryDto {
  @IsOptional()
  @IsString()
  status?: string
}

class CompatReportListQueryDto {
  @IsOptional()
  @IsEnum(LabReportStatus)
  status?: LabReportStatus
}

@ApiTags('Pharmana Compatibility')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PharmanaCompatController {
  constructor(
    private readonly sampleService: SampleContextService,
    private readonly methodService: MethodContextService,
    private readonly workflowService: LabWorkflowContextService,
    private readonly qaService: QaContextService,
    private readonly reportService: ReportContextService,
    private readonly auditService: AuditContextService,
  ) {}

  // ---------- Sample Management Compatibility ----------
  @Get('samples')
  listSamples(
    @OrganizationId() organizationId: string,
    @Query('status') status?: LabSampleStatus,
  ) {
    return this.sampleService.findAll(organizationId, status)
  }

  @Post('samples')
  createSample(@Body() dto: CreateLabSampleDto, @OrganizationId() organizationId: string) {
    return this.sampleService.create(dto, organizationId)
  }

  @Get('samples/:id')
  getSample(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.sampleService.findOne(id, organizationId)
  }

  @Patch('samples/:id')
  updateSample(
    @Param('id') id: string,
    @Body() dto: UpdateLabSampleDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.sampleService.update(id, dto, organizationId)
  }

  @Patch('samples/:id/status')
  updateSampleStatus(
    @Param('id') id: string,
    @Body() dto: CompatStatusDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.sampleService.updateStatus(id, dto.status, organizationId)
  }

  @Post('samples/:id/assign-method')
  assignMethod(
    @Param('id') id: string,
    @Body() dto: CompatAssignMethodDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.sampleService.assignMethod(id, dto.assignedMethodId, dto.assignedAnalystId, organizationId)
  }

  // ---------- Method Registry Compatibility ----------
  @Get('methods')
  listMethods(@OrganizationId() organizationId: string) {
    return this.methodService.findAll(organizationId)
  }

  @Post('methods')
  createMethod(@Body() dto: CreateLabMethodDto, @OrganizationId() organizationId: string) {
    return this.methodService.create(dto, organizationId)
  }

  @Get('methods/:id')
  getMethod(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.methodService.findOne(id, organizationId)
  }

  @Patch('methods/:id')
  updateMethod(
    @Param('id') id: string,
    @Body() dto: UpdateLabMethodDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.methodService.update(id, dto, organizationId)
  }

  @Post('methods/:id/versions')
  createMethodVersion(
    @Param('id') id: string,
    @Body() dto: CreateLabMethodVersionDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.methodService.createVersion(id, dto, organizationId)
  }

  // ---------- Workflow Execution Compatibility ----------
  @Get('analyst/work-queue')
  getWorkQueue(
    @CurrentUser() user: { id: string },
    @OrganizationId() organizationId: string,
    @Query() _query: CompatWorkQueueQueryDto,
  ) {
    return this.workflowService.getAnalystWorkQueue(organizationId, user.id)
  }

  @Post('workflow/execution')
  startWorkflow(
    @Body() dto: CreateLabWorkflowExecutionDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.workflowService.create(dto, organizationId)
  }

  @Get('workflow/:executionId')
  getWorkflowExecution(
    @Param('executionId') executionId: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.workflowService.findOne(executionId, organizationId)
  }

  @Post('workflow/:executionId/steps/complete')
  completeWorkflowStep(
    @Param('executionId') executionId: string,
    @Body() dto: UpdateLabWorkflowStepDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.workflowService.completeStep(executionId, dto, organizationId)
  }

  // ---------- QA Compatibility ----------
  @Get('qa/review-queue')
  getReviewQueue(@OrganizationId() organizationId: string) {
    return this.qaService.getReviewQueue(organizationId)
  }

  @Post('qa/submissions')
  submitQa(
    @Body() dto: CreateLabQaSubmissionDto,
    @CurrentUser() user: { id: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.qaService.submit(dto, user.id, organizationId)
  }

  @Post('qa/reviews')
  reviewQa(
    @Body() dto: ReviewLabQaSubmissionDto,
    @CurrentUser() user: { id: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.qaService.review(dto, user.id, organizationId)
  }

  // ---------- Report Compatibility ----------
  @Get('reports')
  listReports(
    @OrganizationId() organizationId: string,
    @Query() query: CompatReportListQueryDto,
  ) {
    return this.reportService.list(organizationId, query.status)
  }

  @Post('reports')
  createReport(@Body() dto: CreateLabReportDto, @OrganizationId() organizationId: string) {
    return this.reportService.create(dto, organizationId)
  }

  @Get('reports/:id')
  getReport(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.reportService.get(id, organizationId)
  }

  @Post('reports/:id/generate')
  generateReport(
    @Param('id') id: string,
    @Body() dto: GenerateLabReportDto,
    @CurrentUser() user: { id: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.reportService.generate(id, dto, user.id, organizationId)
  }

  @Post('reports/:id/finalize')
  finalizeReport(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.reportService.finalize(id, user.id, organizationId)
  }

  // ---------- Audit Compatibility ----------
  @Post('audit/logs')
  appendAuditLog(
    @Body() dto: CreateLabAuditLogDto,
    @CurrentUser() user: { id: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.auditService.append(dto, user.id, organizationId)
  }

  @Get('audit/logs')
  queryAuditLogs(
    @Query() query: QueryLabAuditLogDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.auditService.query(query, organizationId)
  }

  @Get('audit/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportAuditLogs(
    @Query() query: QueryLabAuditLogDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.auditService.exportCsv(query, organizationId)
  }
}
