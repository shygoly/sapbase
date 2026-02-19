import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { UsersService } from '../users/users.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { User } from '../users/user.entity'

export interface JwtPayload {
  sub: string
  email: string
  role: string
  permissions: string[]
  organizationId?: string
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private organizationsService: OrganizationsService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email)
    if (!user) return null

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    return isPasswordValid ? user : null
  }

  async login(user: User, organizationId?: string) {
    // Get user's organizations
    const organizations = await this.organizationsService.findAll(user.id)

    // If organizationId provided, verify user has access
    let selectedOrgId = organizationId
    if (organizationId) {
      const org = await this.organizationsService.findOne(organizationId, user.id)
      selectedOrgId = org.id
    } else if (organizations.length === 1) {
      // Auto-select if only one organization
      selectedOrgId = organizations[0].id
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      organizationId: selectedOrgId,
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
      },
      organizations,
      currentOrganizationId: selectedOrgId,
    }
  }

  async switchOrganization(userId: string, organizationId: string): Promise<{ access_token: string }> {
    const user = await this.usersService.findOne(userId)
    if (!user) {
      throw new Error('User not found')
    }

    // Verify user has access to organization
    await this.organizationsService.findOne(organizationId, userId)

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      organizationId,
    }

    return {
      access_token: this.jwtService.sign(payload),
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
