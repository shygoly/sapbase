import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PluginRepository } from './plugin.repository'
import { Plugin as PluginOrm } from './plugin.entity'
import { Plugin, PluginStatus, PluginType } from '../../domain/entities/plugin.entity'

describe('PluginRepository', () => {
  let repository: PluginRepository
  let ormRepository: Repository<PluginOrm>

  const mockOrmRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginRepository,
        {
          provide: getRepositoryToken(PluginOrm),
          useValue: mockOrmRepository,
        },
      ],
    }).compile()

    repository = module.get<PluginRepository>(PluginRepository)
    ormRepository = module.get<Repository<PluginOrm>>(
      getRepositoryToken(PluginOrm),
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('findAll', () => {
    it('should return all plugins for organization', async () => {
      const orgId = 'org-1'
      const mockPlugins = [
        {
          id: 'plugin-1',
          organizationId: orgId,
          name: 'test-plugin',
          version: '1.0.0',
          type: PluginType.INTEGRATION,
          status: PluginStatus.ACTIVE,
          manifest: {},
          installPath: '/path',
        },
      ]

      mockOrmRepository.find.mockResolvedValue(mockPlugins)

      const result = await repository.findAll(orgId)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('test-plugin')
      expect(mockOrmRepository.find).toHaveBeenCalledWith({
        where: { organizationId: orgId },
      })
    })
  })

  describe('findById', () => {
    it('should return plugin by id', async () => {
      const orgId = 'org-1'
      const pluginId = 'plugin-1'
      const mockPlugin = {
        id: pluginId,
        organizationId: orgId,
        name: 'test-plugin',
        version: '1.0.0',
        type: PluginType.INTEGRATION,
        status: PluginStatus.ACTIVE,
        manifest: {},
        installPath: '/path',
      }

      mockOrmRepository.findOne.mockResolvedValue(mockPlugin)

      const result = await repository.findById(pluginId, orgId)

      expect(result).toBeDefined()
      expect(result?.id).toBe(pluginId)
      expect(mockOrmRepository.findOne).toHaveBeenCalledWith({
        where: { id: pluginId, organizationId: orgId },
      })
    })

    it('should return null if plugin not found', async () => {
      mockOrmRepository.findOne.mockResolvedValue(null)

      const result = await repository.findById('non-existent', 'org-1')

      expect(result).toBeNull()
    })
  })

  describe('save', () => {
    it('should save plugin', async () => {
      const plugin = Plugin.create(
        'plugin-1',
        'org-1',
        {
          name: 'test-plugin',
          version: '1.0.0',
          type: PluginType.INTEGRATION,
          permissions: {},
          entry: { backend: 'index.js' },
        },
        '/path',
      )

      const mockOrmPlugin = {
        id: 'plugin-1',
        organizationId: 'org-1',
        name: 'test-plugin',
        version: '1.0.0',
        type: PluginType.INTEGRATION,
        status: PluginStatus.INSTALLED,
        manifest: {},
        installPath: '/path',
      }

      mockOrmRepository.save.mockResolvedValue(mockOrmPlugin)

      const result = await repository.save(plugin)

      expect(result).toBeDefined()
      expect(mockOrmRepository.save).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should delete plugin', async () => {
      mockOrmRepository.delete.mockResolvedValue({ affected: 1 })

      await repository.delete('plugin-1', 'org-1')

      expect(mockOrmRepository.delete).toHaveBeenCalledWith({
        id: 'plugin-1',
        organizationId: 'org-1',
      })
    })
  })
})
