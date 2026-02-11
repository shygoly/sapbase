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
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { DepartmentsService } from './departments.service'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { ApiResponseDto, PaginatedResponseDto } from '../common'

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  async create(@Body() createDepartmentDto: CreateDepartmentDto) {
    const department = await this.departmentsService.create(createDepartmentDto)
    return ApiResponseDto.created(department, 'Department created successfully')
  }

  @Get()
  @ApiOperation({ summary: 'Get all departments with pagination' })
  @ApiResponse({ status: 200, description: 'Departments retrieved successfully' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number = 10,
  ) {
    const result = await this.departmentsService.findAll(page, pageSize)
    return PaginatedResponseDto.create(
      result.data,
      result.page,
      result.pageSize,
      result.total,
      'Departments retrieved successfully',
    )
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific department by ID' })
  @ApiResponse({ status: 200, description: 'Department retrieved successfully' })
  async findOne(@Param('id') id: string) {
    const department = await this.departmentsService.findOne(id)
    return ApiResponseDto.success(department, 'Department retrieved successfully')
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Update a department' })
  @ApiResponse({ status: 200, description: 'Department updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    const department = await this.departmentsService.update(id, updateDepartmentDto)
    return ApiResponseDto.success(department, 'Department updated successfully')
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a department' })
  @ApiResponse({ status: 204, description: 'Department deleted successfully' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.departmentsService.remove(id)
  }
}
