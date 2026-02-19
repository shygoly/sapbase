import { Inject, Injectable } from '@nestjs/common'
import { AuthenticationError } from '../../domain/errors'
import { CredentialValidator, OrganizationSelector } from '../../domain/domain-services'
import type { IUserRepository } from '../../domain/repositories'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IPasswordService } from '../../domain/services'
import type { IJwtService } from '../../domain/services'
import type { JwtPayload } from '../../domain/value-objects'
import {
  USER_REPOSITORY,
  ORGANIZATION_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import { JWT_SERVICE, PASSWORD_SERVICE } from '../../domain/services'
import type { IEventPublisher } from '../../domain/events'
import { UserLoggedInEvent } from '../../domain/events'

export interface LoginCommand {
  email: string
  password: string
  organizationId?: string
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
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    // Validate credential format
    CredentialValidator.validate(command.email, command.password)

    // Find user
    const user = await this.userRepository.findByEmail(command.email.toLowerCase().trim())
    if (!user || !user.passwordHash) {
      throw new AuthenticationError('Invalid credentials')
    }

    // Validate password
    const isPasswordValid = await this.passwordService.compare(command.password, user.passwordHash)
    if (!isPasswordValid) {
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
      throw new AuthenticationError('User does not have access to the specified organization')
    }

    // Build JWT payload
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      organizationId: selectedOrgId,
    }

    // Sign token
    const access_token = await this.jwtService.sign(payload)

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
        permissions: user.permissions || [],
      },
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      })),
      currentOrganizationId: selectedOrgId,
    }
  }
}
