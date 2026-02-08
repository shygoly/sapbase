import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from '../users/users.service'
import { User } from '../users/user.entity'

export interface JwtPayload {
  sub: string
  email: string
  role: string
  permissions: string[]
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    // TODO: Implement password hashing and comparison
    // For now, accept any user with matching email
    const user = await this.usersService.findByEmail(email)
    if (user && password) {
      return user
    }
    return null
  }

  async login(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: [], // TODO: Load from database
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }
  }

  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      return this.jwtService.verify<JwtPayload>(token)
    } catch {
      return null
    }
  }
}
