import { Test, TestingModule } from '@nestjs/testing'
import { AddMemberService } from './add-member.service'
import {
  ORGANIZATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type {
  IOrganizationRepository,
  IOrganizationMemberRepository,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { Organization } from '../../domain/entities/organization.entity'
import { OrganizationMember, OrganizationRole } from '../../domain/entities/organization-member.entity'
import { BusinessRuleViolation } from '../../domain/errors'
import { MemberAddedEvent } from '../../domain/events'
import { createMockEventPublisher, createMockRepository } from '../../../test/utils/test-helpers'
import { OrganizationBuilder, OrganizationMemberBuilder } from '../../../test/utils/domain-builders'

describe('AddMemberService', () => {
  let service: AddMemberService
  let organizationRepository: jest.Mocked<IOrganizationRepository>
  let memberRepository: jest.Mocked<IOrganizationMemberRepository>
  let eventPublisher: jest.Mocked<IEventPublisher>

  beforeEach(async () => {
    const mockOrganizationRepository = createMockRepository<IOrganizationRepository>()
    const mockMemberRepository = createMockRepository<IOrganizationMemberRepository>()
    const mockEventPublisher = createMockEventPublisher()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddMemberService,
        {
          provide: ORGANIZATION_REPOSITORY,
          useValue: mockOrganizationRepository,
        },
        {
          provide: ORGANIZATION_MEMBER_REPOSITORY,
          useValue: mockMemberRepository,
        },
        {
          provide: EVENT_PUBLISHER,
          useValue: mockEventPublisher,
        },
      ],
    }).compile()

    service = module.get<AddMemberService>(AddMemberService)
    organizationRepository = module.get(ORGANIZATION_REPOSITORY)
    memberRepository = module.get(ORGANIZATION_MEMBER_REPOSITORY)
    eventPublisher = module.get(EVENT_PUBLISHER)
  })

  describe('execute', () => {
    it('should add a member successfully', async () => {
      const organization = new OrganizationBuilder()
        .withId('org-1')
        .withName('Test Org')
        .build()

      const command = {
        organizationId: 'org-1',
        userId: 'user-2',
        role: OrganizationRole.MEMBER,
      }

      organizationRepository.findById.mockResolvedValue(organization)
      memberRepository.findByOrganizationAndUser.mockResolvedValue(null)
      memberRepository.save.mockResolvedValue(undefined)

      const result = await service.execute(command)

      expect(result).toBeDefined()
      expect(result.userId).toBe('user-2')
      expect(result.organizationId).toBe('org-1')
      expect(memberRepository.save).toHaveBeenCalled()
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.any(MemberAddedEvent),
      )
    })

    it('should throw error if organization not found', async () => {
      const command = {
        organizationId: 'org-999',
        userId: 'user-2',
        role: OrganizationRole.MEMBER,
      }

      organizationRepository.findById.mockResolvedValue(null)

      await expect(service.execute(command)).rejects.toThrow()
    })

    it('should throw error if member already exists', async () => {
      const organization = new OrganizationBuilder()
        .withId('org-1')
        .build()

      const existingMember = new OrganizationMemberBuilder()
        .withOrganizationId('org-1')
        .withUserId('user-2')
        .build()

      const command = {
        organizationId: 'org-1',
        userId: 'user-2',
        role: OrganizationRole.MEMBER,
      }

      organizationRepository.findById.mockResolvedValue(organization)
      memberRepository.findByOrganizationAndUser.mockResolvedValue(existingMember)

      await expect(service.execute(command)).rejects.toThrow(
        BusinessRuleViolation,
      )
    })
  })
})
