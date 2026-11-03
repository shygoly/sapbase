import { Inject, Injectable } from '@nestjs/common'
import { AuthenticationError } from '../../domain/errors'
import type { IUserRepository } from '../../domain/repositories'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IEffectivePermissionsResolver } from '../../domain/services'
import { EFFECTIVE_PERMISSIONS_RESOLVER } from '../../domain/services'
import {
  USER_REPOSITORY,
  ORGANIZATION_REPOSITORY,
} from '../../domain/repositories'

export interface ProfileResult {
  id: string
  name: string
  email: string
  role: string
  permissions: string[]
  organizations: Array<{ id: string; name: string; slug: string }>
}

@Injectable()
export class GetProfileService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(EFFECTIVE_PERMISSIONS_RESOLVER)
    private readonly effectivePermissions: IEffectivePermissionsResolver,
  ) {}

  async getProfile(userId: string, organizationId?: string): Promise<ProfileResult> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new AuthenticationError('User not found')
    }

    const organizations = await this.organizationRepository.findAll(userId)

    /**
     * 必须返回「有效权限」（角色权限 ∪ 直接授权），与登录时一致。
     * 只回 user.permissions 会让前端刷新后把角色带来的权限全部丢掉，
     * admin 区 RBAC 直接把用户挡到 Access Denied。
     */
    const permissions = await this.effectivePermissions.resolve({
      role: user.role,
      directPermissions: user.permissions || [],
      organizationId,
    })

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions,
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      })),
    }
  }
}
