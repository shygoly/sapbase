import { Inject, Injectable, Optional } from '@nestjs/common'
import { randomBytes, randomUUID } from 'node:crypto'
import { AuthenticationError } from '../../domain/errors'
import { CredentialValidator, OrganizationSelector } from '../../domain/domain-services'
import type { IUserRepository } from '../../domain/repositories'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IPasswordService } from '../../domain/services'
import type { IJwtService } from '../../domain/services'
import type { IEffectivePermissionsResolver } from '../../domain/services'
import type { JwtPayload } from '../../domain/value-objects'
import {
  USER_REPOSITORY,
  ORGANIZATION_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import { JWT_SERVICE, PASSWORD_SERVICE, EFFECTIVE_PERMISSIONS_RESOLVER } from '../../domain/services'
import type { IEventPublisher } from '../../domain/events'
import { UserLoggedInEvent } from '../../domain/events'
import { OrganizationMemberRolesService } from '../../../identity/organization-member-roles.service'
import { AuthLoginEventsService } from '../../../identity/auth-login-events.service'
import { AuthSessionsService, hashRefreshToken } from '../../../identity/auth-sessions.service'

export interface LoginCommand {
  email: string
  password: string
  organizationId?: string
  ip?: string
  userAgent?: string
}

export interface LoginResult {
  access_token: string
  user: {
    id: string
    name: string
    email: string
    role: string
    permissions: string[]
  }
  organizations: Array<{ id: string; name: string; slug: string }>
  currentOrganizationId: string | undefined
  sessionId?: string
  refreshToken?: string
}

@Injectable()
export class LoginService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(PASSWORD_SERVICE)
    private readonly passwordService: IPasswordService,
    @Inject(JWT_SERVICE)
    private readonly jwtService: IJwtService,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
    @Inject(EFFECTIVE_PERMISSIONS_RESOLVER)
    private readonly effectivePermissionsResolver: IEffectivePermissionsResolver,
    @Optional() private readonly memberRoles?: OrganizationMemberRolesService,
    @Optional() private readonly loginEvents?: AuthLoginEventsService,
    @Optional() private readonly sessions?: AuthSessionsService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const email = command.email?.toLowerCase().trim() ?? ''
    try {
      // Validate credential format
      CredentialValidator.validate(command.email, command.password)
    } catch (error) {
      await this.recordFailure(command, email, 'invalid-format')
      throw error
    }

    if (command.organizationId) {
      const locked = await this.loginEvents?.isLocked(command.organizationId, email)
      if (locked) {
        await this.recordFailure(command, email, 'locked')
        throw new AuthenticationError('账号暂时锁定，请稍后再试')
      }
    }

    // Find user
    const user = await this.userRepository.findByEmail(email)
    if (!user || !user.passwordHash) {
      await this.recordFailure(command, email, 'invalid-credentials')
      throw new AuthenticationError('Invalid credentials')
    }

    // Validate password
    const isPasswordValid = await this.passwordService.compare(command.password, user.passwordHash)
    if (!isPasswordValid) {
      await this.recordFailure(command, email, 'invalid-credentials')
      throw new AuthenticationError('Invalid credentials')
    }

    // Get user's organizations
    const organizations = await this.organizationRepository.findAll(user.id)

    // Select organization
    const selectedOrgId = OrganizationSelector.select(
      organizations,
      command.organizationId,
    )

    // Verify user has access to selected organization if provided
    if (command.organizationId && selectedOrgId !== command.organizationId) {
      await this.recordFailure(command, email, 'organization-access-denied')
      throw new AuthenticationError('User does not have access to the specified organization')
    }

    const additionalRoles = selectedOrgId
      ? (await this.memberRoles?.activeRoleNames(selectedOrgId, user.id)) ?? []
      : []
    const permissions = await this.resolvePermissions(
      user.role,
      user.permissions || [],
      selectedOrgId,
      additionalRoles,
    )

    const sid = selectedOrgId ? randomUUID() : undefined
    const refreshToken = sid ? randomBytes(32).toString('hex') : undefined
    if (sid && selectedOrgId && refreshToken) {
      await this.sessions?.create({
        organizationId: selectedOrgId,
        userId: user.id,
        sid,
        refreshTokenHash: hashRefreshToken(refreshToken),
        ip: command.ip ?? null,
        userAgent: command.userAgent ?? null,
      })
    }

    // Build JWT payload
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions,
      organizationId: selectedOrgId,
      sid,
    }

    // Sign token
    const access_token = await this.jwtService.sign(payload)

    if (selectedOrgId) {
      await this.loginEvents?.record({
        organizationId: selectedOrgId,
        userId: user.id,
        email: user.email,
        provider: 'password',
        status: 'success',
        ip: command.ip ?? null,
        userAgent: command.userAgent ?? null,
      })
    }

    // Publish event
    await this.eventPublisher.publish(
      new UserLoggedInEvent(user.id, user.email, selectedOrgId, new Date()),
    )

    return {
      access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
      },
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      })),
      currentOrganizationId: selectedOrgId,
      sessionId: sid,
      refreshToken,
    }
  }

  private async recordFailure(
    command: LoginCommand,
    email: string,
    reason: string,
  ): Promise<void> {
    if (!command.organizationId) return
    await this.loginEvents?.record({
      organizationId: command.organizationId,
      email,
      provider: 'password',
      status: 'failure',
      ip: command.ip ?? null,
      userAgent: command.userAgent ?? null,
      reason,
    })
  }

  private async resolvePermissions(
    role: string,
    directPermissions: readonly string[],
    organizationId?: string,
    additionalRoles?: readonly string[],
  ): Promise<string[]> {
    try {
      const resolved = await this.effectivePermissionsResolver.resolve({
        role,
        ...(additionalRoles && additionalRoles.length > 0 ? { additionalRoles } : {}),
        directPermissions,
        organizationId,
      })
      return resolved.length > 0 ? resolved : [...directPermissions]
    } catch {
      return [...directPermissions]
    }
  }
}
