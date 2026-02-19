import { Test, TestingModule } from '@nestjs/testing'
import { SwitchOrganizationService } from './switch-organization.service'
import {
  USER_REPOSITORY,
  ORGANIZATION_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import { JWT_SERVICE } from '../../domain/services'
import type {
  IUserRepository,
  IOrganizationRepository,
} from '../../domain/repositories'
import type { IJwtService } from '../../domain/services'
import type { IEventPublisher } from '../../domain/events'
import { AuthenticationError } from '../../domain/errors'
import { createMockEventPublisher, createMockRepository } from '../../../test/utils/test-helpers'

describe('SwitchOrganizationService', () => {
  let service: SwitchOrganizationService
  let userRepository: jest.Mocked<IUserRepository>
  let organizationRepository: jest.Mocked<IOrganizationRepository>
  let jwtService: jest.Mocked<IJwtService>
  let eventPublisher: jest.Mocked<IEventPublisher>

  beforeEach(async () => {
    const mockUserRepository = createMockRepository<IUserRepository>()
    const mockOrganizationRepository = createMockRepository<IOrganizationRepository>()
    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    }
    const mockEventPublisher = createMockEventPublisher()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwitchOrganizationService,
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepository,
        },
        {
          provide: ORGANIZATION_REPOSITORY,
          useValue: mockOrganizationRepository,
        },
        {
          provide: JWT_SERVICE,
          useValue: mockJwtService,
        },
        {
          provide: EVENT_PUBLISHER,
          useValue: mockEventPublisher,
        },
      ],
    }).compile()

    service = module.get<SwitchOrganizationService>(SwitchOrganizationService)
    userRepository = module.get(USER_REPOSITORY)
    organizationRepository = module.get(ORGANIZATION_REPOSITORY)
    jwtService = module.get(JWT_SERVICE)
    eventPublisher = module.get(EVENT_PUBLISHER)
  })

  describe('execute', () => {
    it('should switch organization successfully', async () => {
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
      }

      const organization = {
        id: 'org-2',
        name: 'New Org',
      }

      const command = {
        userId: 'user-1',
        organizationId: 'org-2',
        currentOrganizationId: 'org-1',
      }

      userRepository.findById.mockResolvedValue(user)
      organizationRepository.findById.mockResolvedValue(organization)
      jwtService.sign.mockReturnValue('new-jwt-token')

      const result = await service.execute(command)

      expect(result).toBeDefined()
      expect(result.accessToken).toBe('new-jwt-token')
      expect(result.organization).toBeDefined()
      expect(eventPublisher.publish).toHaveBeenCalled()
    })

    it('should throw error if user not found', async () => {
      const command = {
        userId: 'user-999',
        organizationId: 'org-2',
        currentOrganizationId: 'org-1',
      }

      userRepository.findById.mockResolvedValue(null)

      await expect(service.execute(command)).rejects.toThrow()
    })

    it('should throw error if organization not found', async () => {
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
      }

      const command = {
        userId: 'user-1',
        organizationId: 'org-999',
        currentOrganizationId: 'org-1',
      }

      userRepository.findById.mockResolvedValue(user)
      organizationRepository.findById.mockResolvedValue(null)

      await expect(service.execute(command)).rejects.toThrow()
    })
  })
})
