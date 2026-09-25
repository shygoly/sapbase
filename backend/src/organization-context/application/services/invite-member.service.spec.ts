import { Test, TestingModule } from '@nestjs/testing'
import { InviteMemberService } from './invite-member.service'
import {
  ORGANIZATION_REPOSITORY,
  INVITATION_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type {
  IOrganizationRepository,
  IInvitationRepository,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { Organization } from '../../domain/entities/organization.entity'
import { Invitation, InvitationStatus } from '../../domain/entities/invitation.entity'
import { OrganizationRole } from '../../domain/entities/organization-member.entity'
import { BusinessRuleViolation } from '../../domain/errors'
import { createMockEventPublisher, createMockRepository } from '../../../../test/utils/test-helpers'
import { OrganizationBuilder } from '../../../../test/utils/domain-builders'

describe('InviteMemberService', () => {
  let service: InviteMemberService
  let organizationRepository: jest.Mocked<IOrganizationRepository>
  let invitationRepository: jest.Mocked<IInvitationRepository>
  let eventPublisher: jest.Mocked<IEventPublisher>

  beforeEach(async () => {
    const mockOrganizationRepository = createMockRepository<IOrganizationRepository>()
    const mockInvitationRepository = createMockRepository<IInvitationRepository>()
    const mockEventPublisher = createMockEventPublisher()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteMemberService,
        {
          provide: ORGANIZATION_REPOSITORY,
          useValue: mockOrganizationRepository,
        },
        {
          provide: INVITATION_REPOSITORY,
          useValue: mockInvitationRepository,
        },
        {
          provide: EVENT_PUBLISHER,
          useValue: mockEventPublisher,
        },
      ],
    }).compile()

    service = module.get<InviteMemberService>(InviteMemberService)
    organizationRepository = module.get(ORGANIZATION_REPOSITORY)
    invitationRepository = module.get(INVITATION_REPOSITORY)
    eventPublisher = module.get(EVENT_PUBLISHER)
  })

  describe('execute', () => {
    it('should create an invitation successfully', async () => {
      const organization = new OrganizationBuilder()
        .withId('org-1')
        .build()

      const command = {
        organizationId: 'org-1',
        email: 'newuser@example.com',
        role: OrganizationRole.MEMBER,
        invitedById: 'user-1',
      }

      organizationRepository.findById.mockResolvedValue(organization)
      invitationRepository.findByOrganizationAndEmail.mockResolvedValue(null)
      invitationRepository.save.mockResolvedValue(undefined)

      const result = await service.execute(command)

      expect(result).toBeDefined()
      expect(result.email).toBe('newuser@example.com')
      expect(result.organizationId).toBe('org-1')
      expect(invitationRepository.save).toHaveBeenCalled()
    })

    it('should throw error if organization not found', async () => {
      const command = {
        organizationId: 'org-999',
        email: 'user@example.com',
        role: OrganizationRole.MEMBER,
        invitedById: 'user-1',
      }

      organizationRepository.findById.mockResolvedValue(null)

      await expect(service.execute(command)).rejects.toThrow()
    })

    it('should throw error if invitation already exists', async () => {
      const organization = new OrganizationBuilder()
        .withId('org-1')
        .build()

      const existingInvitation = Invitation.fromPersistence(
        'invitation-1',
        'org-1',
        'user@example.com',
        OrganizationRole.MEMBER,
        'user-1',
        InvitationStatus.PENDING,
        'token-123',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        new Date(),
      )

      const command = {
        organizationId: 'org-1',
        email: 'user@example.com',
        role: OrganizationRole.MEMBER,
        invitedById: 'user-1',
      }

      organizationRepository.findById.mockResolvedValue(organization)
      invitationRepository.findByOrganizationAndEmail.mockResolvedValue(existingInvitation)

      await expect(service.execute(command)).rejects.toThrow(
        BusinessRuleViolation,
      )
    })
  })
})
