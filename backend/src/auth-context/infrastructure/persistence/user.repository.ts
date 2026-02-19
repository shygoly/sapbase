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
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions || [],
      passwordHash: user.passwordHash,
    }
  }
}
