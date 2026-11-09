import { UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { hashRefreshToken } from '../identity/auth-sessions.service'

function serviceWith(session: any) {
  const users = { findOne: jest.fn(async () => ({ id: 'u1', email: 'a@example.com', role: 'teacher', permissions: [] })) }
  const jwt = { sign: jest.fn(() => 'new-token') }
  const orgs = {}
  const permissions = { resolve: jest.fn(async () => ['student:read']) }
  const memberRoles = { activeRoleNames: jest.fn(async () => ['teacher']) }
  const sessions = {
    findActive: jest.fn(async () => session),
    create: jest.fn(async (input) => input),
    revoke: jest.fn(async () => true),
  }
  return {
    service: new AuthService(
      users as never,
      jwt as never,
      orgs as never,
      permissions as never,
      memberRoles as never,
      sessions as never,
    ),
    sessions,
    jwt,
  }
}

describe('AuthService.refresh', () => {
  it('正确 refresh token → 轮换 sid + 新 token，旧会话被吊销', async () => {
    const session = {
      sid: 'old-sid',
      userId: 'u1',
      organizationId: 'org-1',
      refreshTokenHash: hashRefreshToken('refresh-1'),
    }
    const { service, sessions, jwt } = serviceWith(session)
    const result = await service.refresh('old-sid', 'refresh-1')
    expect(result.access_token).toBe('new-token')
    expect(result.sessionId).not.toBe('old-sid')
    expect(result.refreshToken).not.toBe('refresh-1')
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'u1',
        refreshTokenHash: hashRefreshToken(result.refreshToken),
      }),
    )
    expect(sessions.revoke).toHaveBeenCalledWith('old-sid', 'rotated')
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sid: result.sessionId, organizationId: 'org-1' }),
    )
  })

  it('refresh token 不匹配 → 401', async () => {
    const session = {
      sid: 'old-sid',
      userId: 'u1',
      organizationId: 'org-1',
      refreshTokenHash: hashRefreshToken('refresh-1'),
    }
    const { service } = serviceWith(session)
    await expect(service.refresh('old-sid', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('会话不存在 → 401', async () => {
    const { service } = serviceWith(null)
    await expect(service.refresh('missing', 'x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })
})
