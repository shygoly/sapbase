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
  Req,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { Auth } from '../common/decorators/auth.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { ApiResponseDto, PaginatedResponseDto } from '../common'

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Auth('users:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async create(@Body() createUserDto: CreateUserDto, @Req() req: any) {
    const organizationId = req.organizationId
    const createdBy = req.user?.sub
    const user = await this.usersService.create(createUserDto, organizationId, createdBy)
    return ApiResponseDto.created(user, 'User created successfully')
  }

  @Get()
  @Auth('users:read')
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findAll(
    @OrganizationId() organizationId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number = 10,
    @Query('search') search?: string,
  ) {
    const result = await this.usersService.findAll(page, pageSize, search, organizationId)
    return PaginatedResponseDto.create(
      result.data,
      result.page,
      result.pageSize,
      result.total,
      'Users retrieved successfully',
    )
  }

  @Get(':id')
  @Auth('users:read')
  @ApiOperation({ summary: 'Get a specific user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  async findOne(@Param('id') id: string, @OrganizationId() organizationId: string) {
    const user = await this.usersService.findOne(id, organizationId)
    return ApiResponseDto.success(user, 'User retrieved successfully')
  }

  @Put(':id')
  @Auth('users:update')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @OrganizationId() organizationId: string,
  ) {
    const user = await this.usersService.update(id, updateUserDto, organizationId)
    return ApiResponseDto.success(user, 'User updated successfully')
  }

  @Delete(':id')
  @Auth('users:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  async remove(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ): Promise<void> {
    return this.usersService.remove(id, organizationId)
  }
}
