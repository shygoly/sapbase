import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { UsersService } from '../users/users.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { User } from '../users/user.entity'
import { Optional } from '@nestjs/common'
import { randomBytes, randomUUID } from 'node:crypto'
import { EffectivePermissionsService } from '../roles/effective-permissions.service'
import { OrganizationMemberRolesService } from '../identity/organization-member-roles.service'
import { AuthSessionsService, hashRefreshToken } from '../identity/auth-sessions.service'
import { AuthLoginEventsService } from '../identity/auth-login-events.service'

export interface JwtPayload {
  sub: string
  email: string
  role: string
  permissions: string[]
  organizationId?: string
  sid?: string
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private organizationsService: OrganizationsService,
    private effectivePermissions: EffectivePermissionsService,
    @Optional() private memberRoles?: OrganizationMemberRolesService,
    @Optional() private sessions?: AuthSessionsService,
    @Optional() private loginEvents?: AuthLoginEventsService,
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

    const roleName = user.roleName || user.role || 'user'
    const additionalRoles = selectedOrgId
      ? await this.memberRoles?.activeRoleNames(selectedOrgId, user.id)
      : []
    // 角色权限由 EffectivePermissionsService 按「本次选中组织 + active 角色并集」解析，
    // 再与直授权限取并集。不要用 user.rolePermissions：那是未经 active/组织校验的预载值。
    const permissions = await this.effectivePermissions.resolve({
      role: roleName,
      additionalRoles,
      directPermissions: user.permissions || [],
      organizationId: selectedOrgId,
    })

    const sid = selectedOrgId ? randomUUID() : undefined
    const refreshToken = sid ? randomBytes(32).toString('hex') : undefined
    if (sid && selectedOrgId && refreshToken) {
      await this.sessions?.create({
        organizationId: selectedOrgId,
        userId: user.id,
        sid,
        refreshTokenHash: hashRefreshToken(refreshToken),
      })
    }
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: roleName,
      permissions,
      organizationId: selectedOrgId,
      sid,
    }

    return {
      access_token: this.jwtService.sign(payload),
      sessionId: sid,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleName,
        roleName,
        roleId: user.roleId,
        permissions,
      },
      organizations,
      currentOrganizationId: selectedOrgId,
    }
  }

  /**
   * SSO 回调完成登录：身份解析已由 IdentitySsoService 完成，这里只做
   * 组织成员校验、有效权限解析、会话/JWT 签发和登录成功审计。
   */
  async loginWithIdentity(input: {
    userId: string
    organizationId: string
    provider: string
    ip?: string
    userAgent?: string
  }) {
    const user = await this.usersService.findOne(input.userId)
    if (!user) throw new UnauthorizedException('用户不存在')

    // 服务端重新校验组织成员关系，不信任 SSO 回调传入的身份范围。
    await this.organizationsService.findOne(input.organizationId, user.id)

    const roleName = user.roleName || user.role || 'user'
    const additionalRoles = await this.memberRoles?.activeRoleNames(
      input.organizationId,
      user.id,
    )
    const permissions = await this.effectivePermissions.resolve({
      role: roleName,
      additionalRoles,
      directPermissions: user.permissions || [],
      organizationId: input.organizationId,
    })

    const sid = randomUUID()
    const refreshToken = randomBytes(32).toString('hex')
    await this.sessions?.create({
      organizationId: input.organizationId,
      userId: user.id,
      sid,
      refreshTokenHash: hashRefreshToken(refreshToken),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    })

    await this.loginEvents?.record({
      organizationId: input.organizationId,
      userId: user.id,
      email: user.email,
      provider: input.provider,
      status: 'success',
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    })

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: roleName,
      permissions,
      organizationId: input.organizationId,
      sid,
    }

    const organizations = await this.organizationsService.findAll(user.id)
    return {
      access_token: this.jwtService.sign(payload),
      sessionId: sid,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleName,
        roleName,
        roleId: user.roleId,
        permissions,
      },
      organizations,
      currentOrganizationId: input.organizationId,
    }
  }

  async switchOrganization(
    userId: string,
    organizationId: string,
  ): Promise<{ access_token: string; sessionId?: string; refreshToken?: string }> {
    const user = await this.usersService.findOne(userId)
    if (!user) {
      throw new Error('User not found')
    }

    // Verify user has access to organization
    await this.organizationsService.findOne(organizationId, userId)

    const roleName = user.roleName || user.role || 'user'
    const additionalRoles = await this.memberRoles?.activeRoleNames(organizationId, user.id)
    const permissions = await this.effectivePermissions.resolve({
      role: roleName,
      additionalRoles,
      directPermissions: user.permissions || [],
      organizationId,
    })

    const sid = randomUUID()
    const refreshToken = randomBytes(32).toString('hex')
    await this.sessions?.create({
      organizationId,
      userId: user.id,
      sid,
      refreshTokenHash: hashRefreshToken(refreshToken),
    })
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: roleName,
      permissions,
      organizationId,
      sid,
    }

    return {
      access_token: this.jwtService.sign(payload),
      sessionId: sid,
      refreshToken,
    }
  }

  async refresh(
    sid: string,
    refreshToken: string,
  ): Promise<{ access_token: string; sessionId: string; refreshToken: string }> {
    const session = await this.sessions?.findActive(sid)
    if (!session) throw new UnauthorizedException('会话已失效，请重新登录')
    if (
      !session.refreshTokenHash ||
      session.refreshTokenHash !== hashRefreshToken(refreshToken)
    ) {
      throw new UnauthorizedException('refresh token 无效')
    }
    const user = await this.usersService.findOne(session.userId)
    if (!user) throw new UnauthorizedException('用户不存在')
    const roleName = user.roleName || user.role || 'user'
    const additionalRoles = await this.memberRoles?.activeRoleNames(
      session.organizationId,
      user.id,
    )
    const permissions = await this.effectivePermissions.resolve({
      role: roleName,
      additionalRoles,
      directPermissions: user.permissions || [],
      organizationId: session.organizationId,
    })
    const nextSid = randomUUID()
    const nextRefresh = randomBytes(32).toString('hex')
    await this.sessions?.create({
      organizationId: session.organizationId,
      userId: user.id,
      sid: nextSid,
      refreshTokenHash: hashRefreshToken(nextRefresh),
    })
    await this.sessions?.revoke(sid, 'rotated')
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: roleName,
      permissions,
      organizationId: session.organizationId,
      sid: nextSid,
    }
    return {
      access_token: this.jwtService.sign(payload),
      sessionId: nextSid,
      refreshToken: nextRefresh,
    }
  }

  async logout(sid?: string): Promise<{ revoked: boolean }> {
    if (!sid) return { revoked: false }
    return { revoked: (await this.sessions?.revoke(sid, 'logout')) ?? false }
  }

  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      return this.jwtService.verify<JwtPayload>(token)
    } catch {
      return null
    }
  }
}
