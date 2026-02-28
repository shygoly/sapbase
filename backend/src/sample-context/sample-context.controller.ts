import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsOptional, IsUUID } from 'class-validator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { SampleContextService } from './sample-context.service'
import { CreateLabSampleDto } from './dto/create-lab-sample.dto'
import { UpdateLabSampleDto } from './dto/update-lab-sample.dto'
import { LabSampleStatus } from './lab-sample.entity'

class AssignMethodDto {
  @IsUUID()
  assignedMethodId: string

  @IsOptional()
  @IsUUID()
  assignedAnalystId?: string
}

@ApiTags('Lab Samples')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab/samples')
export class SampleContextController {
  constructor(private readonly sampleService: SampleContextService) {}

  @Post()
  create(@Body() dto: CreateLabSampleDto, @OrganizationId() organizationId: string) {
    return this.sampleService.create(dto, organizationId)
  }

  @Get()
  findAll(
    @OrganizationId() organizationId: string,
    @Query('status') status?: LabSampleStatus,
  ) {
    return this.sampleService.findAll(organizationId, status)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.sampleService.findOne(id, organizationId)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLabSampleDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.sampleService.update(id, dto, organizationId)
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: { status: LabSampleStatus },
    @OrganizationId() organizationId: string,
  ) {
    return this.sampleService.updateStatus(id, dto.status, organizationId)
  }

  @Post(':id/assign-method')
  assignMethod(
    @Param('id') id: string,
    @Body() dto: AssignMethodDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.sampleService.assignMethod(id, dto.assignedMethodId, dto.assignedAnalystId, organizationId)
  }
}
