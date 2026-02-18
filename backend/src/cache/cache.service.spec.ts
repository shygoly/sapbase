import { Test, TestingModule } from '@nestjs/testing'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { CacheService } from './cache.service'
import { Cache } from 'cache-manager'

describe('CacheService', () => {
  let service: CacheService
  let cacheManager: Cache

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile()

    service = module.get<CacheService>(CacheService)
    cacheManager = module.get<Cache>(CACHE_MANAGER)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('get', () => {
    it('should get value from cache', async () => {
      const key = 'test-key'
      const value = { data: 'test' }
      mockCacheManager.get.mockResolvedValue(value)

      const result = await service.get(key)

      expect(result).toEqual(value)
      expect(mockCacheManager.get).toHaveBeenCalledWith(key)
    })
  })

  describe('set', () => {
    it('should set value in cache', async () => {
      const key = 'test-key'
      const value = { data: 'test' }
      const ttl = 300

      await service.set(key, value, ttl)

      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, ttl)
    })
  })

  describe('del', () => {
    it('should delete value from cache', async () => {
      const key = 'test-key'

      await service.del(key)

      expect(mockCacheManager.del).toHaveBeenCalledWith(key)
    })
  })

  describe('generateKey', () => {
    it('should generate cache key with prefix', () => {
      const key = service.generateKey('prefix', 'part1', 'part2')
      expect(key).toBe('prefix:part1:part2')
    })
  })

  describe('orgKey', () => {
    it('should generate organization-scoped cache key', () => {
      const key = service.orgKey('org-123', 'data', 'item-456')
      expect(key).toBe('org:org-123:data:item-456')
    })
  })
})
