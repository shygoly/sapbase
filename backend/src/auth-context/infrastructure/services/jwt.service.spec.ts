import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { JwtServiceImpl } from './jwt.service'
import type { IJwtService } from '../../domain/services'

describe('JwtServiceImpl (Infrastructure)', () => {
  let service: IJwtService
  let jwtService: jest.Mocked<JwtService>
  let configService: jest.Mocked<ConfigService>

  beforeEach(async () => {
    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    }

    const mockConfigService = {
      get: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtServiceImpl,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    service = module.get<IJwtService>(JwtServiceImpl)
    jwtService = module.get(JwtService)
    configService = module.get(ConfigService)
  })

  describe('sign', () => {
    it('should sign payload and return token', () => {
      const payload = { userId: 'user-1', organizationId: 'org-1' }
      jwtService.sign.mockReturnValue('jwt-token')

      const result = service.sign(payload)

      expect(result).toBe('jwt-token')
      expect(jwtService.sign).toHaveBeenCalledWith(payload)
    })
  })

  describe('verify', () => {
    it('should verify token and return payload', () => {
      const token = 'jwt-token'
      const payload = { userId: 'user-1', organizationId: 'org-1' }
      jwtService.verify.mockReturnValue(payload)

      const result = service.verify(token)

      expect(result).toEqual(payload)
      expect(jwtService.verify).toHaveBeenCalledWith(token)
    })

    it('should throw error for invalid token', () => {
      const token = 'invalid-token'
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      expect(() => {
        service.verify(token)
      }).toThrow()
    })
  })
})
