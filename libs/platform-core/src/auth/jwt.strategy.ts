import { Injectable, Optional, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { AuthSessionsService } from '../identity/auth-sessions.service'
import { UsersService } from '../users/users.service'

export interface JwtPayload {
  sub: string
  email: string
  role: string
  permissions: string[]
  organizationId?: string
  sid?: string
  /** 权限版本；角色/直授变更后旧 token 拒绝。 */
  pv?: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Optional() private sessions?: AuthSessionsService,
    @Optional() private users?: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // 与 JwtModule 保持同一来源（ConfigService），避免签名/验签密钥不一致
      secretOrKey: config.get<string>('JWT_SECRET') || 'your-secret-key',
    })
  }

  async validate(payload: JwtPayload) {
    if (payload.sid) {
      await this.sessions?.assertActive(payload.sid)
    }
    if (payload.pv !== undefined) {
      const state = await this.users?.findAuthState(payload.sub)
      if (!state || state.status !== 'active') {
        throw new UnauthorizedException('账号已停用或不存在')
      }
      if ((state.permissionVersion ?? 1) !== payload.pv) {
        throw new UnauthorizedException('权限已变更，请重新登录')
      }
    }
    return {
      id: payload.sub,
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
      organizationId: payload.organizationId,
      sid: payload.sid,
    }
  }
}
