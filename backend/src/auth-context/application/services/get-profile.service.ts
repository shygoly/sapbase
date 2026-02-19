import { Inject, Injectable } from '@nestjs/common'
import { AuthenticationError } from '../../domain/errors'
import type { IUserRepository } from '../../domain/repositories'
import type { IOrganizationRepository } from '../../domain/repositories'
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
  ) {}

  async getProfile(userId: string): Promise<ProfileResult> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new AuthenticationError('User not found')
    }

    const organizations = await this.organizationRepository.findAll(userId)

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      })),
    }
  }
}
