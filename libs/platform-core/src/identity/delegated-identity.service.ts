import { Injectable, Optional } from '@nestjs/common'
import { UsersService } from '../users/users.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { EffectivePermissionsService } from '../roles/effective-permissions.service'
import { OrganizationMemberRolesService } from './organization-member-roles.service'
import { DataScopeService } from '../data-scope/data-scope.service'

export interface DelegatedIdentity {
  userId: string
  role: string
  roles: string[]
  permissions: string[]
}

/**
 * 服务令牌代用户调用：服务端重新解析用户/组织/角色/权限。
 *
 * **不信任**调用方传入的 role/permissions。数据范围由业务入口再按
 * resourceKey/action 解析（本服务只负责身份与功能权限）。
 */
@Injectable()
export class DelegatedIdentityService {
  constructor(
    private readonly users: UsersService,
    private readonly organizations: OrganizationsService,
    private readonly effectivePermissions: EffectivePermissionsService,
    private readonly memberRoles: OrganizationMemberRolesService,
    @Optional() private readonly dataScope?: DataScopeService,
  ) {}

  async resolve(organizationId: string, userId: string): Promise<DelegatedIdentity> {
    // 先验证成员关系；跨组织直接 404（不泄露）
    await this.organizations.findOne(organizationId, userId)
    const user = await this.users.findOne(userId)
    const additionalRoles = await this.memberRoles.activeRoleNames(organizationId, userId)
    const role = user.roleName || user.role || additionalRoles[0] || 'user'
    const permissions = await this.effectivePermissions.resolve({
      role,
      additionalRoles,
      directPermissions: user.permissions || [],
      organizationId,
    })
    return {
      userId: user.id,
      role,
      roles: [...new Set([role, ...additionalRoles])],
      permissions,
    }
  }

  /**
   * 服务令牌代用户读取数据范围：不信任调用方 scope，按组织/用户/资源/动作
   * 重新解析；未声明范围时返回 declared=false（租户隔离仍生效）。
   */
  async resolveDataScope(
    organizationId: string,
    userId: string,
    resourceKey: string,
    action: string,
  ) {
    const identity = await this.resolve(organizationId, userId)
    if (!this.dataScope) {
      return { ...identity, scope: null, declared: false }
    }
    const resolved = await this.dataScope.resolve({
      organizationId,
      actor: {
        userId: identity.userId,
        roleKeys: identity.roles,
        groupKeys: [],
        permissions: identity.permissions,
      },
      resourceKey,
      action,
    })
    return {
      ...identity,
      scope: resolved.expr,
      scopeVersion: resolved.version,
      declared: resolved.declared,
    }
  }
}
