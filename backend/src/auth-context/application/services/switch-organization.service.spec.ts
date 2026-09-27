import { Test, TestingModule } from '@nestjs/testing'
import { SwitchOrganizationService } from './switch-organization.service'
import type { User } from '../../../users/user.entity'
import type { Organization } from '../../../organization-context/domain/entities/organization.entity'
import {
  USER_REPOSITORY,
  ORGANIZATION_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../domain/repositories'
import { JWT_SERVICE, EFFECTIVE_PERMISSIONS_RESOLVER } from '../../domain/services'
import type {
  IUserRepository,
  IOrganizationRepository,
} from '../../domain/repositories'
import type { IJwtService, IEffectivePermissionsResolver } from '../../domain/services'
import type { IEventPublisher } from '../../domain/events'
import { AuthenticationError } from '../../domain/errors'
import { createMockEventPublisher, createMockRepository } from '../../../../test/utils/test-helpers'

describe('SwitchOrganizationService', () => {
  let service: SwitchOrganizationService
  let userRepository: jest.Mocked<IUserRepository>
  let organizationRepository: jest.Mocked<IOrganizationRepository>
  let jwtService: jest.Mocked<IJwtService>
  let eventPublisher: jest.Mocked<IEventPublisher>
  let effectivePermissionsResolver: jest.Mocked<IEffectivePermissionsResolver>

  beforeEach(async () => {
    const mockUserRepository = createMockRepository<IUserRepository>()
    const mockOrganizationRepository = createMockRepository<IOrganizationRepository>()
    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    }
    const mockEventPublisher = createMockEventPublisher()
    const mockEffectivePermissionsResolver = {
      resolve: jest.fn(),
    }

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
        {
          provide: EFFECTIVE_PERMISSIONS_RESOLVER,
          useValue: mockEffectivePermissionsResolver,
        },
      ],
    }).compile()

    service = module.get<SwitchOrganizationService>(SwitchOrganizationService)
    userRepository = module.get(USER_REPOSITORY)
    organizationRepository = module.get(ORGANIZATION_REPOSITORY)
    jwtService = module.get(JWT_SERVICE)
    eventPublisher = module.get(EVENT_PUBLISHER)
    effectivePermissionsResolver = module.get(EFFECTIVE_PERMISSIONS_RESOLVER)
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

      userRepository.findById.mockResolvedValue(user as unknown as User)
      organizationRepository.findById.mockResolvedValue(organization as unknown as Organization)
      jwtService.sign.mockResolvedValue('new-jwt-token')
      effectivePermissionsResolver.resolve.mockResolvedValue([])

      const result = await service.execute(command)

      expect(result).toBeDefined()
      expect(result.access_token).toBe('new-jwt-token')
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

      userRepository.findById.mockResolvedValue(user as unknown as User)
      organizationRepository.findById.mockResolvedValue(null)

      await expect(service.execute(command)).rejects.toThrow()
    })

    it('签发的 payload permissions 是有效权限（角色 ∪ 直授）', async () => {
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'clerk',
        permissions: ['direct:write'],
      }
      userRepository.findById.mockResolvedValue(user as unknown as User)
      organizationRepository.findById.mockResolvedValue({
        id: 'org-2',
        name: 'New Org',
      } as unknown as Organization)
      jwtService.sign.mockResolvedValue('new-jwt-token')
      effectivePermissionsResolver.resolve.mockResolvedValue(['role:read', 'direct:write'])

      const result = await service.execute({
        userId: 'user-1',
        organizationId: 'org-2',
        currentOrganizationId: 'org-1',
      })

      expect(effectivePermissionsResolver.resolve).toHaveBeenCalledWith({
        role: 'clerk',
        directPermissions: ['direct:write'],
        organizationId: 'org-2',
      })
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'clerk',
          permissions: ['role:read', 'direct:write'],
          organizationId: 'org-2',
        }),
      )
      expect(result.access_token).toBe('new-jwt-token')
    })

    it('解析器抛错时只留直授且切换仍然成功', async () => {
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'clerk',
        permissions: ['direct:keep'],
      }
      userRepository.findById.mockResolvedValue(user as unknown as User)
      organizationRepository.findById.mockResolvedValue({
        id: 'org-2',
        name: 'New Org',
      } as unknown as Organization)
      jwtService.sign.mockResolvedValue('new-jwt-token')
      effectivePermissionsResolver.resolve.mockRejectedValue(new Error('role lookup failed'))

      const result = await service.execute({
        userId: 'user-1',
        organizationId: 'org-2',
        currentOrganizationId: 'org-1',
      })

      expect(result.access_token).toBe('new-jwt-token')
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ permissions: ['direct:keep'] }),
      )
    })

    it('解析器返回空时只留直授且切换仍然成功', async () => {
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'clerk',
        permissions: ['direct:keep'],
      }
      userRepository.findById.mockResolvedValue(user as unknown as User)
      organizationRepository.findById.mockResolvedValue({
        id: 'org-2',
        name: 'New Org',
      } as unknown as Organization)
      jwtService.sign.mockResolvedValue('new-jwt-token')
      effectivePermissionsResolver.resolve.mockResolvedValue([])

      const result = await service.execute({
        userId: 'user-1',
        organizationId: 'org-2',
        currentOrganizationId: 'org-1',
      })

      expect(result.access_token).toBe('new-jwt-token')
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ permissions: ['direct:keep'] }),
      )
    })
  })
})
