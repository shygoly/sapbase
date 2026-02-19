import { Test, TestingModule } from '@nestjs/testing'
import { AcceptInvitationService } from './accept-invitation.service'
import {
  INVITATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import type {
  IInvitationRepository,
  IOrganizationMemberRepository,
} from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { Invitation } from '../../domain/entities/invitation.entity'
import { OrganizationRole } from '../../domain/entities/organization-member.entity'
import { BusinessRuleViolation } from '../../domain/errors'
import { createMockEventPublisher, createMockRepository } from '../../../test/utils/test-helpers'
import { InvitationBuilder, OrganizationMemberBuilder } from '../../../test/utils/domain-builders'

describe('AcceptInvitationService', () => {
  let service: AcceptInvitationService
  let invitationRepository: jest.Mocked<IInvitationRepository>
  let memberRepository: jest.Mocked<IOrganizationMemberRepository>
  let eventPublisher: jest.Mocked<IEventPublisher>

  beforeEach(async () => {
    const mockInvitationRepository = createMockRepository<IInvitationRepository>()
    const mockMemberRepository = createMockRepository<IOrganizationMemberRepository>()
    const mockEventPublisher = createMockEventPublisher()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcceptInvitationService,
        {
          provide: INVITATION_REPOSITORY,
          useValue: mockInvitationRepository,
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

    service = module.get<AcceptInvitationService>(AcceptInvitationService)
    invitationRepository = module.get(INVITATION_REPOSITORY)
    memberRepository = module.get(ORGANIZATION_MEMBER_REPOSITORY)
    eventPublisher = module.get(EVENT_PUBLISHER)
  })

  describe('execute', () => {
    it('should accept invitation and create member', async () => {
      const invitation = new InvitationBuilder()
        .withId('invitation-1')
        .withOrganizationId('org-1')
        .withEmail('user@example.com')
        .withToken('token-123')
        .build()

      const command = {
        token: 'token-123',
        userId: 'user-1',
      }

      invitationRepository.findByToken.mockResolvedValue(invitation)
      memberRepository.findByOrganizationAndUser.mockResolvedValue(null)
      invitationRepository.save.mockResolvedValue(undefined)
      memberRepository.save.mockResolvedValue(undefined)

      const result = await service.execute(command)

      expect(result).toBeDefined()
      expect(result.organizationId).toBe('org-1')
      expect(result.userId).toBe('user-1')
      expect(invitation.isAccepted()).toBe(true)
      expect(memberRepository.save).toHaveBeenCalled()
    })

    it('should throw error if invitation not found', async () => {
      const command = {
        token: 'invalid-token',
        userId: 'user-1',
      }

      invitationRepository.findByToken.mockResolvedValue(null)

      await expect(service.execute(command)).rejects.toThrow()
    })

    it('should throw error if invitation already accepted', async () => {
      const invitation = new InvitationBuilder()
        .withId('invitation-1')
        .withToken('token-123')
        .accepted()
        .build()

      const command = {
        token: 'token-123',
        userId: 'user-1',
      }

      invitationRepository.findByToken.mockResolvedValue(invitation)

      await expect(service.execute(command)).rejects.toThrow(
        BusinessRuleViolation,
      )
    })

    it('should throw error if invitation expired', async () => {
      const invitation = new InvitationBuilder()
        .withId('invitation-1')
        .withToken('token-123')
        .expired()
        .build()

      const command = {
        token: 'token-123',
        userId: 'user-1',
      }

      invitationRepository.findByToken.mockResolvedValue(invitation)

      await expect(service.execute(command)).rejects.toThrow(
        BusinessRuleViolation,
      )
    })

    it('should throw error if member already exists', async () => {
      const invitation = new InvitationBuilder()
        .withId('invitation-1')
        .withOrganizationId('org-1')
        .withToken('token-123')
        .build()

      const existingMember = new OrganizationMemberBuilder()
        .withOrganizationId('org-1')
        .withUserId('user-1')
        .build()

      const command = {
        token: 'token-123',
        userId: 'user-1',
      }

      invitationRepository.findByToken.mockResolvedValue(invitation)
      memberRepository.findByOrganizationAndUser.mockResolvedValue(existingMember)

      await expect(service.execute(command)).rejects.toThrow(
        BusinessRuleViolation,
      )
    })
  })
})
