import { Inject, Injectable } from '@nestjs/common'
import { AuthenticationError } from '../../domain/errors'
import type { IUserRepository } from '../../domain/repositories'
import type { IOrganizationRepository } from '../../domain/repositories'
import type { IJwtService } from '../../domain/services'
import type { JwtPayload } from '../../domain/value-objects'
import {
  USER_REPOSITORY,
  ORGANIZATION_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import { JWT_SERVICE } from '../../domain/services'
import type { IEventPublisher } from '../../domain/events'
import { OrganizationSwitchedEvent } from '../../domain/events'

export interface SwitchOrganizationCommand {
  userId: string
  organizationId: string
  currentOrganizationId?: string
}

@Injectable()
export class SwitchOrganizationService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly organizationRepository: IOrganizationRepository,
    @Inject(JWT_SERVICE)
    private readonly jwtService: IJwtService,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: SwitchOrganizationCommand): Promise<{ access_token: string }> {
    // Find user
    const user = await this.userRepository.findById(command.userId)
    if (!user) {
      throw new AuthenticationError('User not found')
    }

    // Verify user has access to organization
    const organization = await this.organizationRepository.findById(
      command.organizationId,
      command.userId,
    )
    if (!organization) {
      throw new AuthenticationError('User does not have access to the specified organization')
    }

    // Build JWT payload
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      organizationId: command.organizationId,
    }

    // Sign token
    const access_token = await this.jwtService.sign(payload)

    // Publish event
    await this.eventPublisher.publish(
      new OrganizationSwitchedEvent(
        command.userId,
        command.currentOrganizationId,
        command.organizationId,
        new Date(),
      ),
    )

    return { access_token }
  }
}
