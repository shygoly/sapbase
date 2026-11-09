import { UnauthorizedException } from '@nestjs/common'
import { JwtStrategy } from './jwt.strategy'

function strategyWith(sessions: any) {
  return new JwtStrategy({ get: () => 'secret' } as never, sessions as never)
}

describe('JwtStrategy sid validation', () => {
  it('有 sid 且会话有效 → 放行并带 sid', async () => {
    const user = await strategyWith({ assertActive: jest.fn(async () => ({})) }).validate({
      sub: 'u1',
      email: 'a@example.com',
      role: 'teacher',
      permissions: ['student:read'],
      organizationId: 'org-1',
      sid: 'sid-1',
    })
    expect(user).toMatchObject({ id: 'u1', sid: 'sid-1', organizationId: 'org-1' })
  })

  it('有 sid 但会话已吊销 → 401', async () => {
    await expect(
      strategyWith({
        assertActive: jest.fn(async () => {
          throw new UnauthorizedException('会话已失效')
        }),
      }).validate({
        sub: 'u1',
        email: 'a@example.com',
        role: 'teacher',
        permissions: [],
        sid: 'revoked-sid',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('无 sid 的旧 token 保持兼容（只按 JWT 过期）', async () => {
    const assertActive = jest.fn()
    const user = await strategyWith({ assertActive }).validate({
      sub: 'u1',
      email: 'a@example.com',
      role: 'teacher',
      permissions: [],
    })
    expect(user).toMatchObject({ id: 'u1' })
    expect(assertActive).not.toHaveBeenCalled()
  })
})
