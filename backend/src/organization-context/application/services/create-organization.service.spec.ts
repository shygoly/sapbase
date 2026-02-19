import { Test, TestingModule } from '@nestjs/testing'
import { CreateOrganizationService } from './create-organization.service'
import {
  ORGANIZATION_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type {
  IOrganizationRepository,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { Organization } from '../../domain/entities/organization.entity'
import { OrganizationSlug } from '../../domain/value-objects/organization-slug.vo'
import { BusinessRuleViolation } from '../../domain/errors'
import { OrganizationCreatedEvent } from '../../domain/events'
import { createMockEventPublisher, createMockRepository } from '../../../test/utils/test-helpers'
import { OrganizationBuilder } from '../../../test/utils/domain-builders'

describe('CreateOrganizationService', () => {
  let service: CreateOrganizationService
  let organizationRepository: jest.Mocked<IOrganizationRepository>
  let eventPublisher: jest.Mocked<IEventPublisher>

  beforeEach(async () => {
    const mockOrganizationRepository = createMockRepository<IOrganizationRepository>()
    const mockEventPublisher = createMockEventPublisher()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateOrganizationService,
        {
          provide: ORGANIZATION_REPOSITORY,
          useValue: mockOrganizationRepository,
        },
        {
          provide: EVENT_PUBLISHER,
          useValue: mockEventPublisher,
        },
      ],
    }).compile()

    service = module.get<CreateOrganizationService>(CreateOrganizationService)
    organizationRepository = module.get(ORGANIZATION_REPOSITORY)
    eventPublisher = module.get(EVENT_PUBLISHER)
  })

  describe('execute', () => {
    it('should create an organization successfully', async () => {
      const command = {
        name: 'Test Organization',
        creatorUserId: 'user-1',
      }

      organizationRepository.findBySlug.mockResolvedValue(null)
      organizationRepository.save.mockResolvedValue(undefined)

      const result = await service.execute(command)

      expect(result).toBeDefined()
      expect(result.name).toBe('Test Organization')
      expect(organizationRepository.findBySlug).toHaveBeenCalled()
      expect(organizationRepository.save).toHaveBeenCalled()
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.any(OrganizationCreatedEvent),
      )
    })

    it('should throw error if slug already exists', async () => {
      const command = {
        name: 'Test Organization',
        creatorUserId: 'user-1',
      }

      const existingOrg = new OrganizationBuilder()
        .withName('Existing Org')
        .withSlug('test-organization')
        .build()

      organizationRepository.findBySlug.mockResolvedValue(existingOrg)

      await expect(service.execute(command)).rejects.toThrow(
        BusinessRuleViolation,
      )
    })

    it('should add creator as owner member', async () => {
      const command = {
        name: 'Test Organization',
        creatorUserId: 'user-1',
      }

      organizationRepository.findBySlug.mockResolvedValue(null)
      organizationRepository.save.mockResolvedValue(undefined)

      const result = await service.execute(command)

      expect(result.members.length).toBeGreaterThan(0)
      const creatorMember = result.members.find((m) => m.userId === 'user-1')
      expect(creatorMember).toBeDefined()
      expect(creatorMember?.role).toBe('owner')
    })
  })
})
