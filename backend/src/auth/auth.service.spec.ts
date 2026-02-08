import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { AuthService } from './auth.service'
import { UsersService } from '../users/users.service'

describe('AuthService', () => {
  let service: AuthService
  let usersService: UsersService
  let jwtService: JwtService

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    password: 'hashedPassword',
    name: 'Test User',
    role: 'user',
    dataScope: 'self',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    usersService = module.get<UsersService>(UsersService)
    jwtService = module.get<JwtService>(JwtService)
  })

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser)

      const result = await service.validateUser('test@example.com', 'password')

      expect(result).toEqual(mockUser)
      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com')
    })

    it('should return null when user does not exist', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null)

      const result = await service.validateUser('nonexistent@example.com', 'password')

      expect(result).toBeNull()
    })
  })

  describe('login', () => {
    it('should generate JWT token with correct payload', async () => {
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockJwtToken)

      const result = await service.login(mockUser)

      expect(result).toEqual({
        access_token: mockJwtToken,
        user: mockUser,
      })
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
      })
    })

    it('should include user data in response', async () => {
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockJwtToken)

      const result = await service.login(mockUser)

      expect(result.user).toEqual(mockUser)
      expect(result.user.email).toBe('test@example.com')
    })
  })

  describe('validateToken', () => {
    it('should validate valid JWT token', async () => {
      const payload = { sub: '1', email: 'test@example.com' }
      jest.spyOn(jwtService, 'verify').mockReturnValue(payload)

      const result = service.validateToken(mockJwtToken)

      expect(result).toEqual(payload)
      expect(jwtService.verify).toHaveBeenCalledWith(mockJwtToken)
    })

    it('should reject expired token', () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('jwt expired')
      })

      expect(() => service.validateToken(mockJwtToken)).toThrow()
    })

    it('should reject malformed token', () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('invalid token')
      })

      expect(() => service.validateToken('invalid')).toThrow()
    })
  })
})
