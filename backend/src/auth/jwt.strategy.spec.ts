import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { JwtStrategy } from './jwt.strategy'

describe('JwtStrategy', () => {
  let strategy: JwtStrategy
  let jwtService: JwtService

  const mockJwtService = {
    verify: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile()

    strategy = module.get<JwtStrategy>(JwtStrategy)
    jwtService = module.get<JwtService>(JwtService)
  })

  describe('validate', () => {
    it('should validate and extract user from valid token', async () => {
      const payload = {
        sub: '1',
        email: 'test@example.com',
      }

      const result = await strategy.validate(payload)

      expect(result).toEqual({
        id: '1',
        email: 'test@example.com',
      })
    })

    it('should reject token without userId', async () => {
      const payload = {
        email: 'test@example.com',
      }

      await expect(strategy.validate(payload)).rejects.toThrow()
    })

    it('should handle non-existent user gracefully', async () => {
      const payload = {
        sub: 'nonexistent',
        email: 'nonexistent@example.com',
      }

      const result = await strategy.validate(payload)

      expect(result).toBeDefined()
      expect(result.id).toBe('nonexistent')
    })
  })
})
