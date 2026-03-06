import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { DepartmentsService } from './departments.service'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'
import { Auth } from '../common/decorators/auth.decorator'
import { ApiResponseDto, PaginatedResponseDto } from '../common'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Auth('departments:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  async create(@Body() createDepartmentDto: CreateDepartmentDto, @OrganizationId() organizationId: string) {
    const department = await this.departmentsService.create(createDepartmentDto, organizationId)
    return ApiResponseDto.created(department, 'Department created successfully')
  }

  @Get()
  @Auth('departments:read')
  @ApiOperation({ summary: 'Get all departments with pagination' })
  @ApiResponse({ status: 200, description: 'Departments retrieved successfully' })
  async findAll(
    @OrganizationId() organizationId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number = 10,
  ) {
    const result = await this.departmentsService.findAll(organizationId, page, pageSize)
    return PaginatedResponseDto.create(
      result.data,
      result.page,
      result.pageSize,
      result.total,
      'Departments retrieved successfully',
    )
  }

  @Get(':id')
  @Auth('departments:read')
  @ApiOperation({ summary: 'Get a specific department by ID' })
  @ApiResponse({ status: 200, description: 'Department retrieved successfully' })
  async findOne(@Param('id') id: string, @OrganizationId() organizationId: string) {
    const department = await this.departmentsService.findOne(id, organizationId)
    return ApiResponseDto.success(department, 'Department retrieved successfully')
  }

  @Put(':id')
  @Auth('departments:update')
  @ApiOperation({ summary: 'Update a department' })
  @ApiResponse({ status: 200, description: 'Department updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
    @OrganizationId() organizationId: string,
  ) {
    const department = await this.departmentsService.update(id, updateDepartmentDto, organizationId)
    return ApiResponseDto.success(department, 'Department updated successfully')
  }

  @Delete(':id')
  @Auth('departments:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a department' })
  @ApiResponse({ status: 204, description: 'Department deleted successfully' })
  async remove(@Param('id') id: string, @OrganizationId() organizationId: string): Promise<void> {
    return this.departmentsService.remove(id, organizationId)
  }
}
