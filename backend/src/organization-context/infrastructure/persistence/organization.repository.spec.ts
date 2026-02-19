import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OrganizationRepository } from './organization.repository'
import { Organization as OrganizationOrm } from '../../../organizations/organization.entity'
import { OrganizationMember as OrganizationMemberOrm } from '../../../organizations/organization-member.entity'
import { Organization } from '../../domain/entities/organization.entity'
import { OrganizationSlug } from '../../domain/value-objects/organization-slug.vo'
import { OrganizationBuilder } from '../../../test/utils/domain-builders'

describe('OrganizationRepository (Infrastructure)', () => {
  let repository: OrganizationRepository
  let orgRepo: jest.Mocked<Repository<OrganizationOrm>>
  let memberRepo: jest.Mocked<Repository<OrganizationMemberOrm>>

  beforeEach(async () => {
    const mockOrgRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    }

    const mockMemberRepo = {
      find: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationRepository,
        {
          provide: getRepositoryToken(OrganizationOrm),
          useValue: mockOrgRepo,
        },
        {
          provide: getRepositoryToken(OrganizationMemberOrm),
          useValue: mockMemberRepo,
        },
      ],
    }).compile()

    repository = module.get<OrganizationRepository>(OrganizationRepository)
    orgRepo = module.get(getRepositoryToken(OrganizationOrm))
    memberRepo = module.get(getRepositoryToken(OrganizationMemberOrm))
  })

  describe('findById', () => {
    it('should find organization by id', async () => {
      const orgOrm = {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        subscriptionStatus: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      orgRepo.findOne.mockResolvedValue(orgOrm as any)
      memberRepo.find.mockResolvedValue([])

      const result = await repository.findById('org-1')

      expect(result).toBeDefined()
      expect(result?.id).toBe('org-1')
      expect(orgRepo.findOne).toHaveBeenCalledWith({ where: { id: 'org-1' } })
    })

    it('should return null if not found', async () => {
      orgRepo.findOne.mockResolvedValue(null)
      memberRepo.find.mockResolvedValue([])

      const result = await repository.findById('org-999')

      expect(result).toBeNull()
    })
  })

  describe('findBySlug', () => {
    it('should find organization by slug', async () => {
      const orgOrm = {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        subscriptionStatus: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      orgRepo.findOne.mockResolvedValue(orgOrm as any)
      memberRepo.find.mockResolvedValue([])

      const result = await repository.findBySlug('test-org')

      expect(result).toBeDefined()
      expect(result?.slug.value).toBe('test-org')
    })
  })

  describe('save', () => {
    it('should save organization', async () => {
      const organization = new OrganizationBuilder()
        .withId('org-1')
        .withName('Test Org')
        .build()

      orgRepo.save.mockResolvedValue({
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        subscriptionStatus: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      memberRepo.find.mockResolvedValue([])
      memberRepo.save.mockResolvedValue(undefined as any)

      await repository.save(organization)

      expect(orgRepo.save).toHaveBeenCalled()
    })
  })
})
