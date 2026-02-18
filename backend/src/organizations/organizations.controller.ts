import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import { Organization } from './organization.entity'
import { OrganizationMember, OrganizationRole } from './organization-member.entity'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../users/user.entity'

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Auth()
  async create(@Body() body: { name: string }, @CurrentUser() user: User): Promise<Organization> {
    return this.organizationsService.create(body.name, user.id)
  }

  @Get()
  @Auth()
  async findAll(@CurrentUser() user: User): Promise<Organization[]> {
    return this.organizationsService.findAll(user.id)
  }

  @Get(':id')
  @Auth()
  async findOne(@Param('id') id: string, @CurrentUser() user: User): Promise<Organization> {
    return this.organizationsService.findOne(id, user.id)
  }

  @Patch(':id')
  @Auth()
  async update(
    @Param('id') id: string,
    @Body() updates: Partial<Organization>,
    @CurrentUser() user: User,
  ): Promise<Organization> {
    return this.organizationsService.update(id, updates, user.id)
  }

  @Get(':id/members')
  @Auth()
  async getMembers(@Param('id') id: string, @CurrentUser() user: User): Promise<OrganizationMember[]> {
    return this.organizationsService.getMembers(id, user.id)
  }

  @Post(':id/members')
  @Auth()
  async addMember(
    @Param('id') id: string,
    @Body() body: { userId: string; role: OrganizationRole },
    @CurrentUser() user: User,
  ): Promise<OrganizationMember> {
    return this.organizationsService.addMember(id, body.userId, body.role)
  }

  @Delete(':id/members/:userId')
  @Auth()
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.organizationsService.removeMember(id, userId, user.id)
  }

  @Patch(':id/members/:userId/role')
  @Auth()
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { role: OrganizationRole },
    @CurrentUser() user: User,
  ): Promise<OrganizationMember> {
    return this.organizationsService.updateMemberRole(id, userId, body.role, user.id)
  }
}
