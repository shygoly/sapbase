import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { AuthService } from './auth.service'

// 密码比对走 bcrypt.compare：不 mock 的话 validateUser 永远返回 null
jest.mock('bcrypt')
import { UsersService } from '../users/users.service'
// 实体构造是私有的：替身用 cast（change: restore-green-backend-tests）
import type { User } from '../users/user.entity'
import { OrganizationsService } from '../organizations/organizations.service'

describe('AuthService', () => {
  let service: AuthService
  let usersService: UsersService
  let jwtService: JwtService

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    passwordHash: 'hashedPassword',
    name: 'Test User',
    role: 'user',
    dataScope: 'self',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>
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
        // 服务后来加了「登录时带出用户组织、必要时自动选中」这一步
        {
          provide: OrganizationsService,
          useValue: { findAll: jest.fn().mockResolvedValue([]), findOne: jest.fn() },
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

    mockBcrypt.compare.mockResolvedValue(true as never)
    service = module.get<AuthService>(AuthService)
    usersService = module.get<UsersService>(UsersService)
    jwtService = module.get<JwtService>(JwtService)
  })

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as unknown as User)

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

      const result = await service.login(mockUser as unknown as User)

      // 响应体现在含 organizations 与 currentOrganizationId（登录时带出用户所属组织）
      expect(result).toEqual({
        access_token: mockJwtToken,
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          role: mockUser.role,
          permissions: [],
        },
        organizations: [],
        currentOrganizationId: undefined,
      })
      // payload 现在是完整的 JwtPayload（role / permissions / organizationId 都要有）
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        permissions: [],
        organizationId: undefined,
      })
    })

    it('should include user data in response', async () => {
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockJwtToken)

      const result = await service.login(mockUser as unknown as User)

      // 响应里的 user 是**脱敏后的摘要**（不含 passwordHash / dataScope）
      expect(result.user.email).toBe('test@example.com')
      expect(result.user).not.toHaveProperty('passwordHash')
    })
  })

  describe('validateToken', () => {
    it('should validate valid JWT token', async () => {
      const payload = { sub: '1', email: 'test@example.com' }
      jest.spyOn(jwtService, 'verify').mockReturnValue(payload)

      const result = await service.validateToken(mockJwtToken)

      expect(result).toEqual(payload)
      expect(jwtService.verify).toHaveBeenCalledWith(mockJwtToken)
    })

    // 真实契约：validateToken 捕获异常并返回 null（返回类型就是 Promise<JwtPayload | null>）。
    // 旧断言写"应抛错"，与实现相反，已登记在 change 的 tasks.md。
    it('should return null for an expired token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('jwt expired')
      })

      await expect(service.validateToken(mockJwtToken)).resolves.toBeNull()
    })

    it('should return null for a malformed token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('invalid token')
      })

      await expect(service.validateToken('invalid')).resolves.toBeNull()
    })
  })
})
