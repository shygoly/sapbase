import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { AuthService } from './auth.service'

export interface JwtPayload {
  sub: string
  email: string
  role: string
  permissions: string[]
  organizationId?: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // 与 JwtModule 保持同一来源（ConfigService），避免签名/验签密钥不一致
      secretOrKey: config.get<string>('JWT_SECRET') || 'your-secret-key',
    })
  }

  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
      organizationId: payload.organizationId,
    }
  }
}
