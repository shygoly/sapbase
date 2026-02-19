import { Injectable } from '@nestjs/common'
import { GetOrganizationService } from '../../../organization-context/application/services/get-organization.service'
import { OrganizationsService } from '../../../organizations/organizations.service'
import type { IOrganizationRepository, Organization } from '../../domain/repositories'

@Injectable()
export class OrganizationRepository implements IOrganizationRepository {
  constructor(
    private readonly getOrganizationService: GetOrganizationService,
    private readonly organizationsService: OrganizationsService, // Use old service for findAll
  ) {}

  async findById(id: string, userId: string): Promise<Organization | null> {
    try {
      const organization = await this.getOrganizationService.get(id, userId)
      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      }
    } catch {
      return null
    }
  }

  async findAll(userId: string): Promise<Organization[]> {
    const orgs = await this.organizationsService.findAll(userId)
    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
    }))
  }
}
