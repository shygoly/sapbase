import { Injectable } from '@nestjs/common'
import { UsersService } from '../../../users/users.service'
import type { IUserRepository, User } from '../../domain/repositories'

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly usersService: UsersService) {}

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email)
    if (!user) return null
    return this.mapToDomain(user)
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.usersService.findOne(id)
    if (!user) return null
    return this.mapToDomain(user)
  }

  private mapToDomain(user: any): User {
    const roleName = user.roleName || user.role || 'user'
    // 直授权限（users.permissions 列）。角色权限**不**在这里注入 —— 由
    // IEffectivePermissionsResolver 按「本次选中组织 + 同名 active 角色」解析；
    // 否则未经 active/组织校验的 rolePermissions 会经 directPermissions 混进会话。
    const permissions = user.permissions || []

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: roleName,
      roleId: user.roleId,
      permissions,
      passwordHash: user.passwordHash,
    }
  }
}
