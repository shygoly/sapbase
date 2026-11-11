import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'
import { UsersModule } from '../users/users.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { RolesModule } from '../roles/roles.module'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './jwt.strategy'
import { AuthContextModule } from '../auth-context/auth-context.module'
import { IdentityModule } from '../identity/identity.module'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'

@Module({
  imports: [
    AuthContextModule,
    IdentityModule,
    AuditLogsModule,
    UsersModule,
    OrganizationsModule,
    RolesModule,
    PassportModule,
    // register() 在模块导入阶段求值，早于 ConfigModule 读 .env，会落到兜底密钥；
    // 与 JwtStrategy 的实际密钥不一致会导致登录后所有受保护接口 401。
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
