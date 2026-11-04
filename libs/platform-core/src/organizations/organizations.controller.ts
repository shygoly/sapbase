import { Controller, Get, Post, Patch, Delete, Body, Param, BadRequestException } from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import { Organization } from './organization.entity'
import { OrganizationMember, OrganizationRole } from './organization-member.entity'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../users/user.entity'
import { CreateOrganizationService } from '../organization-context/application/services/create-organization.service'
import { AddMemberService } from '../organization-context/application/services/add-member.service'
import { RemoveMemberService } from '../organization-context/application/services/remove-member.service'
import { UpdateMemberRoleService } from '../organization-context/application/services/update-member-role.service'
import { UpdateOrganizationService } from '../organization-context/application/services/update-organization.service'
import { GetOrganizationService } from '../organization-context/application/services/get-organization.service'
import { GetMembersService } from '../organization-context/application/services/get-members.service'
import { BusinessRuleViolation } from '../organization-context/domain/errors'

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly createOrganizationService: CreateOrganizationService,
    private readonly addMemberService: AddMemberService,
    private readonly removeMemberService: RemoveMemberService,
    private readonly updateMemberRoleService: UpdateMemberRoleService,
    private readonly updateOrganizationService: UpdateOrganizationService,
    private readonly getOrganizationService: GetOrganizationService,
    private readonly getMembersService: GetMembersService,
  ) {}

  @Post()
  @Auth()
  async create(@Body() body: { name: string }, @CurrentUser() user: User): Promise<Organization> {
    try {
      const organization = await this.createOrganizationService.execute({
        name: body.name,
        creatorUserId: user.id,
      })
      return this.mapDomainToResponse(organization)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Get()
  @Auth()
  async findAll(@CurrentUser() user: User): Promise<Organization[]> {
    return this.organizationsService.findAll(user.id)
  }

  @Get(':id')
  @Auth()
  async findOne(@Param('id') id: string, @CurrentUser() user: User): Promise<Organization> {
    try {
      const organization = await this.getOrganizationService.get(id, user.id)
      return this.mapDomainToResponse(organization)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Patch(':id')
  @Auth()
  async update(
    @Param('id') id: string,
    @Body() updates: Partial<Organization>,
    @CurrentUser() user: User,
  ): Promise<Organization> {
    try {
      const organization = await this.updateOrganizationService.execute({
        organizationId: id,
        name: updates.name,
        userId: user.id,
      })
      return this.mapDomainToResponse(organization)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Get(':id/members')
  @Auth()
  async getMembers(@Param('id') id: string, @CurrentUser() user: User): Promise<OrganizationMember[]> {
    try {
      const members = await this.getMembersService.getMembers(id, user.id)
      // Load relations for API response
      return this.organizationsService.getMembers(id, user.id) // Use old service to get relations
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Post(':id/members')
  @Auth()
  async addMember(
    @Param('id') id: string,
    @Body() body: { userId: string; role: OrganizationRole },
    @CurrentUser() user: User,
  ): Promise<OrganizationMember> {
    try {
      const member = await this.addMemberService.execute({
        organizationId: id,
        userId: body.userId,
        role: body.role,
        addedById: user.id,
      })
      // Load relations for API response
      const members = await this.organizationsService.getMembers(id, user.id)
      const found = members.find((m) => m.userId === body.userId)
      return found || this.mapDomainMemberToResponse(member)
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Delete(':id/members/:userId')
  @Auth()
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    try {
      return await this.removeMemberService.execute({
        organizationId: id,
        userId,
        removerId: user.id,
      })
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Patch(':id/members/:userId/role')
  @Auth()
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { role: OrganizationRole },
    @CurrentUser() user: User,
  ): Promise<OrganizationMember> {
    try {
      await this.updateMemberRoleService.execute({
        organizationId: id,
        userId,
        newRole: body.role,
        updaterId: user.id,
      })
      // Return updated member with relations
      const members = await this.organizationsService.getMembers(id, user.id)
      const member = members.find((m) => m.userId === userId)
      if (!member) {
        throw new BadRequestException('Member not found')
      }
      return member
    } catch (err) {
      if (err instanceof BusinessRuleViolation) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  private mapDomainToResponse(organization: any): Organization {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      subscriptionStatus: organization.subscriptionStatus,
      stripeCustomerId: organization.stripeCustomerId,
      stripeSubscriptionId: organization.stripeSubscriptionId,
      stripeProductId: organization.stripeProductId,
      planName: organization.planName,
      createdAt: (organization as any).createdAt || new Date(),
      updatedAt: (organization as any).updatedAt || new Date(),
    } as Organization
  }

  private mapDomainMemberToResponse(member: any): OrganizationMember {
    return {
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      invitedById: member.invitedById,
      joinedAt: member.joinedAt,
      createdAt: (member as any).createdAt || new Date(),
      updatedAt: (member as any).updatedAt || new Date(),
    } as any as OrganizationMember
  }
}
