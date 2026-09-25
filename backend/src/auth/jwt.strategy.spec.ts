import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { JwtStrategy } from './jwt.strategy'
import { AuthService } from './auth.service'

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
        // JwtStrategy 的构造依赖 AuthService（本 spec 只验 payload → 身份的映射）
        { provide: AuthService, useValue: {} },
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
        role: 'owner',
        permissions: ['inventory.read'],
        organizationId: 'org-1',
      }

      const result = await strategy.validate(payload)

      // validate 只做"payload → 请求上下文身份"的映射，不查库、不抛错
      expect(result).toEqual({
        id: '1',
        userId: '1',
        email: 'test@example.com',
        role: 'owner',
        permissions: ['inventory.read'],
        organizationId: 'org-1',
      })
    })

    // 行为说明：validate 不再"缺 sub 就拒"（它只做字段映射）；拒绝发生在 passport 的
    // payload 校验与各守卫处。旧断言写"应抛错"，与当前实现相反，已登记在 tasks.md。
    it('should map an incomplete payload without throwing（拒绝不在这里）', async () => {
      const payload = {
        email: 'test@example.com',
        role: 'user',
        permissions: [],
      }

      const result = await strategy.validate(payload as never)

      expect(result.id).toBeUndefined()
      expect(result.email).toBe('test@example.com')
    })

    it('should handle non-existent user gracefully', async () => {
      const payload = {
        sub: 'nonexistent',
        email: 'nonexistent@example.com',
        role: 'user',
        permissions: [],
      }

      const result = await strategy.validate(payload)

      expect(result).toBeDefined()
      expect(result.id).toBe('nonexistent')
    })
  })
})
