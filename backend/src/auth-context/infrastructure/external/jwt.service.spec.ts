import { Test, TestingModule } from '@nestjs/testing'
import { JwtService as NestJwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { JwtService } from './jwt.service'
import type { IJwtService } from '../../domain/services'

// 位置与类名修正（change: restore-green-backend-tests）：实现与导出的名字是 JwtService
// （infrastructure/external/），而不是 spec 里引用的 './jwt.service' 的 JwtServiceImpl。
// 另外 payload 现在是完整的 JwtPayload（必须带 role 与 permissions）。
describe('JwtService (Infrastructure)', () => {
  let service: IJwtService
  let nestJwt: { sign: jest.Mock; verify: jest.Mock }

  const payload = {
    sub: 'user-1',
    email: 'user@example.com',
    role: 'owner',
    permissions: ['inventory.read'],
    organizationId: 'org-1',
  }

  beforeEach(async () => {
    nestJwt = { sign: jest.fn(), verify: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtService,
        { provide: NestJwtService, useValue: nestJwt },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile()

    service = module.get<IJwtService>(JwtService)
  })

  it('should sign the payload and return the token（异步接口）', async () => {
    nestJwt.sign.mockReturnValue('jwt-token')

    await expect(service.sign(payload)).resolves.toBe('jwt-token')
    expect(nestJwt.sign).toHaveBeenCalledWith(payload)
  })

  it('should verify a token and return the payload', async () => {
    nestJwt.verify.mockResolvedValue(payload)

    await expect(service.verify('jwt-token')).resolves.toEqual(payload)
    expect(nestJwt.verify).toHaveBeenCalledWith('jwt-token')
  })

  // 真实契约是「无效 token 返回 null」而不是抛错（verify 的返回类型就是 Payload | null）：
  // 旧断言写"应抛错"，与实现相反，已登记在 change 的 tasks.md
  it('should return null for an invalid token', async () => {
    nestJwt.verify.mockImplementation(() => {
      throw new Error('Invalid token')
    })

    await expect(service.verify('invalid-token')).resolves.toBeNull()
  })
})
