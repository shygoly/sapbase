import { Body, Controller, Delete, Get, Param, Post, Put, Query, BadRequestException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import {
  DataScopeService,
  type CreateDataPolicyInput,
  type CreateScopeBindingInput,
  type CreateScopeDimensionInput,
  type CreateScopeMembershipInput,
  type CreateScopeNodeInput,
} from './data-scope.service'

interface RuntimeUser {
  id: string
  userId?: string
  role?: string
  roleKeys?: string[]
  groupKeys?: string[]
}

@ApiTags('Data Scope')
@Controller('data-scope')
export class DataScopeController {
  constructor(private readonly dataScope: DataScopeService) {}

  @Get('dimensions')
  @Auth('data-scope:read')
  listDimensions(@OrganizationId() organizationId: string) {
    return this.dataScope.listDimensions(organizationId)
  }

  @Post('dimensions')
  @Auth('data-scope:manage')
  createDimension(
    @OrganizationId() organizationId: string,
    @Body() body: CreateScopeDimensionInput,
  ) {
    return this.dataScope.createDimension(organizationId, body)
  }

  @Delete('dimensions/:id')
  @Auth('data-scope:manage')
  async deleteDimension(@OrganizationId() organizationId: string, @Param('id') id: string) {
    await this.dataScope.deleteDimension(organizationId, id)
    return { ok: true }
  }

  @Get('nodes')
  @Auth('data-scope:read')
  listNodes(
    @OrganizationId() organizationId: string,
    @Query('dimensionId') dimensionId?: string,
  ) {
    return this.dataScope.listNodes(organizationId, dimensionId)
  }

  @Post('nodes')
  @Auth('data-scope:manage')
  createNode(@OrganizationId() organizationId: string, @Body() body: CreateScopeNodeInput) {
    return this.dataScope.createNode(organizationId, body)
  }

  @Delete('nodes/:id')
  @Auth('data-scope:manage')
  async deleteNode(@OrganizationId() organizationId: string, @Param('id') id: string) {
    await this.dataScope.deleteNode(organizationId, id)
    return { ok: true }
  }

  @Put('nodes/:id/move')
  @Auth('data-scope:manage')
  moveNode(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() body: { parentId: string | null },
  ) {
    return this.dataScope.moveNode(organizationId, id, body.parentId ?? null)
  }

  @Get('memberships')
  @Auth('data-scope:read')
  listMemberships(
    @OrganizationId() organizationId: string,
    @Query('nodeId') nodeId?: string,
  ) {
    return this.dataScope.listMemberships(organizationId, nodeId)
  }

  @Post('memberships')
  @Auth('data-scope:manage')
  createMembership(
    @OrganizationId() organizationId: string,
    @Body() body: CreateScopeMembershipInput,
  ) {
    return this.dataScope.createMembership(organizationId, body)
  }

  @Delete('memberships/:id')
  @Auth('data-scope:manage')
  async deleteMembership(@OrganizationId() organizationId: string, @Param('id') id: string) {
    await this.dataScope.deleteMembership(organizationId, id)
    return { ok: true }
  }

  @Get('bindings')
  @Auth('data-scope:read')
  listBindings(
    @OrganizationId() organizationId: string,
    @Query('resourceKey') resourceKey?: string,
  ) {
    return this.dataScope.listBindings(organizationId, resourceKey)
  }

  @Post('bindings')
  @Auth('data-scope:manage')
  createBinding(
    @OrganizationId() organizationId: string,
    @Body() body: CreateScopeBindingInput,
  ) {
    return this.dataScope.createBinding(organizationId, body)
  }

  @Delete('bindings/:id')
  @Auth('data-scope:manage')
  async deleteBinding(@OrganizationId() organizationId: string, @Param('id') id: string) {
    await this.dataScope.deleteBinding(organizationId, id)
    return { ok: true }
  }

  @Get('policies')
  @Auth('data-scope:read')
  listPolicies(
    @OrganizationId() organizationId: string,
    @Query('resourceKey') resourceKey?: string,
  ) {
    return this.dataScope.listPolicies(organizationId, resourceKey)
  }

  @Post('policies')
  @Auth('data-scope:manage')
  createPolicy(
    @OrganizationId() organizationId: string,
    @Body() body: CreateDataPolicyInput,
  ) {
    return this.dataScope.createPolicy(organizationId, body)
  }

  @Delete('policies/:id')
  @Auth('data-scope:manage')
  async deletePolicy(@OrganizationId() organizationId: string, @Param('id') id: string) {
    await this.dataScope.deletePolicy(organizationId, id)
    return { ok: true }
  }

  @Post('preview')
  @Auth('data-scope:read')
  preview(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser,
    @Body() body: { resourceKey: string; action: string },
  ) {
    return this.dataScope.preview({
      organizationId,
      resourceKey: body.resourceKey,
      action: body.action,
      actor: {
        userId: user.userId ?? user.id,
        roleKeys: user.roleKeys ?? (user.role ? [user.role] : []),
        groupKeys: user.groupKeys ?? [],
        permissions: [],
      },
    })
  }

  @Get('preflight')
  @Auth('data-scope:read')
  preflight(
    @OrganizationId() organizationId: string,
    @Query('packageId') packageId?: string,
    @Query('entity') entity?: string,
    @Query('field') field?: string,
  ) {
    if (!packageId || !entity || !field) {
      throw new BadRequestException('packageId / entity / field 必填')
    }
    return this.dataScope.preflightBlueprintField(organizationId, packageId, entity, field)
  }
}
