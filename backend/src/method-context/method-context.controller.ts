import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { MethodContextService } from './method-context.service'
import { CreateLabMethodDto } from './dto/create-lab-method.dto'
import { UpdateLabMethodDto } from './dto/update-lab-method.dto'
import { CreateLabMethodVersionDto } from './dto/create-lab-method-version.dto'
import { LabMethodStatus } from './lab-method.entity'

@ApiTags('Lab Methods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab/methods')
export class MethodContextController {
  constructor(private readonly methodService: MethodContextService) {}

  @Post()
  create(@Body() dto: CreateLabMethodDto, @OrganizationId() organizationId: string) {
    return this.methodService.create(dto, organizationId)
  }

  @Get()
  findAll(
    @OrganizationId() organizationId: string,
    @Query('status') status?: LabMethodStatus,
  ) {
    return this.methodService.findAll(organizationId, status)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.methodService.findOne(id, organizationId)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLabMethodDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.methodService.update(id, dto, organizationId)
  }

  @Post(':id/versions')
  createVersion(
    @Param('id') id: string,
    @Body() dto: CreateLabMethodVersionDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.methodService.createVersion(id, dto, organizationId)
  }

  @Get(':id/versions')
  getVersions(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.methodService.getVersions(id, organizationId)
  }
}
