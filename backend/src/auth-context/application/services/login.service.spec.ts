import { Test, TestingModule } from '@nestjs/testing'
import { LoginService } from './login.service'
import {
  USER_REPOSITORY,
  ORGANIZATION_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import { JWT_SERVICE, PASSWORD_SERVICE } from '../../domain/services'
import type {
  IUserRepository,
  IOrganizationRepository,
} from '../../domain/repositories'
import type { IJwtService, IPasswordService } from '../../domain/services'
import type { IEventPublisher } from '../../domain/events'
import { AuthenticationError } from '../../domain/errors'
import { createMockEventPublisher, createMockRepository } from '../../../test/utils/test-helpers'

describe('LoginService', () => {
  let service: LoginService
  let userRepository: jest.Mocked<IUserRepository>
  let organizationRepository: jest.Mocked<IOrganizationRepository>
  let jwtService: jest.Mocked<IJwtService>
  let passwordService: jest.Mocked<IPasswordService>
  let eventPublisher: jest.Mocked<IEventPublisher>

  beforeEach(async () => {
    const mockUserRepository = createMockRepository<IUserRepository>()
    const mockOrganizationRepository = createMockRepository<IOrganizationRepository>()
    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    }
    const mockPasswordService = {
      compare: jest.fn(),
      hash: jest.fn(),
    }
    const mockEventPublisher = createMockEventPublisher()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginService,
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
          provide: PASSWORD_SERVICE,
          useValue: mockPasswordService,
        },
        {
          provide: EVENT_PUBLISHER,
          useValue: mockEventPublisher,
        },
      ],
    }).compile()

    service = module.get<LoginService>(LoginService)
    userRepository = module.get(USER_REPOSITORY)
    organizationRepository = module.get(ORGANIZATION_REPOSITORY)
    jwtService = module.get(JWT_SERVICE)
    passwordService = module.get(PASSWORD_SERVICE)
    eventPublisher = module.get(EVENT_PUBLISHER)
  })

  describe('execute', () => {
    it('should login successfully with valid credentials', async () => {
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hashed-password',
        name: 'Test User',
      }

      const organization = {
        id: 'org-1',
        name: 'Test Org',
      }

      const command = {
        email: 'user@example.com',
        password: 'password123',
        organizationId: 'org-1',
      }

      userRepository.findByEmail.mockResolvedValue(user)
      passwordService.compare.mockResolvedValue(true)
      organizationRepository.findById.mockResolvedValue(organization)
      jwtService.sign.mockReturnValue('jwt-token')

      const result = await service.execute(command)

      expect(result).toBeDefined()
      expect(result.accessToken).toBe('jwt-token')
      expect(result.user).toBeDefined()
      expect(passwordService.compare).toHaveBeenCalledWith(
        'password123',
        'hashed-password',
      )
      expect(eventPublisher.publish).toHaveBeenCalled()
    })

    it('should throw error if user not found', async () => {
      const command = {
        email: 'nonexistent@example.com',
        password: 'password123',
      }

      userRepository.findByEmail.mockResolvedValue(null)

      await expect(service.execute(command)).rejects.toThrow(
        AuthenticationError,
      )
    })

    it('should throw error if password is incorrect', async () => {
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hashed-password',
        name: 'Test User',
      }

      const command = {
        email: 'user@example.com',
        password: 'wrong-password',
      }

      userRepository.findByEmail.mockResolvedValue(user)
      passwordService.compare.mockResolvedValue(false)

      await expect(service.execute(command)).rejects.toThrow(
        AuthenticationError,
      )
    })

    it('should throw error if organization not found', async () => {
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hashed-password',
        name: 'Test User',
      }

      const command = {
        email: 'user@example.com',
        password: 'password123',
        organizationId: 'org-999',
      }

      userRepository.findByEmail.mockResolvedValue(user)
      passwordService.compare.mockResolvedValue(true)
      organizationRepository.findById.mockResolvedValue(null)

      await expect(service.execute(command)).rejects.toThrow()
    })
  })
})
