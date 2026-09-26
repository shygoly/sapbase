import { Test, TestingModule } from '@nestjs/testing'
import { InviteMemberService } from './invite-member.service'
import {
  ORGANIZATION_MEMBER_REPOSITORY,
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
    // 服务后来加了「邀请前校验邀请人是否为成员」这一步
    const mockMemberRepository = createMockRepository()
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
          provide: ORGANIZATION_MEMBER_REPOSITORY,
          useValue: mockMemberRepository,
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

    // 行为已变更（有意）：重复邀请**不再报错**，而是刷新那条待接受邀请的有效期后复用。
    // 旧断言写的是"应抛错" —— 与当前实现相反，属"能力被有意改成幂等"，已登记在 tasks.md。
    it('should refresh the pending invitation instead of failing（幂等重发）', async () => {
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
        // 只剩 1 天：刷新后应当明显更远（用 7 天做夹具的话，与刷新后的时间在毫秒级上分不出来）
        new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
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
      invitationRepository.save.mockResolvedValue(undefined)

      // 先取原值：服务是**就地**改这条邀请的 expiresAt（复用的就是同一个对象）
      const originalExpiresAt = existingInvitation.expiresAt!.getTime()
      const result = await service.execute(command)

      expect(result.id).toBe('invitation-1')
      expect(result.status).toBe(InvitationStatus.PENDING)
      // 有效期被推后（复用同一条邀请，而不是新建一条）
      expect(result.expiresAt!.getTime()).toBeGreaterThan(originalExpiresAt)
      expect(invitationRepository.save).toHaveBeenCalledWith(existingInvitation)
    })
  })
})
