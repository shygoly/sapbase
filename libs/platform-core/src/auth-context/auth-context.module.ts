import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { UsersModule } from '../users/users.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { OrganizationContextModule } from '../organization-context/organization-context.module'
import { RolesModule } from '../roles/roles.module'
import {
  USER_REPOSITORY,
  ORGANIZATION_REPOSITORY,
  EVENT_PUBLISHER,
} from './domain/repositories'
import { UserRepository } from './infrastructure/persistence/user.repository'
import { OrganizationRepository } from './infrastructure/persistence/organization.repository'
import { EventBusService } from '../common/events'
import { LoginService } from './application/services/login.service'
import { SwitchOrganizationService } from './application/services/switch-organization.service'
import { ValidateTokenService } from './application/services/validate-token.service'
import { GetProfileService } from './application/services/get-profile.service'
import { JWT_SERVICE, PASSWORD_SERVICE, EFFECTIVE_PERMISSIONS_RESOLVER } from './domain/services'
import { JwtService } from './infrastructure/external/jwt.service'
import { PasswordService } from './infrastructure/external/password.service'
import { EffectivePermissionsResolver } from './infrastructure/external/effective-permissions.resolver'
import { IdentityModule } from '../identity/identity.module'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'

@Module({
  imports: [
    /**
     * 登录/切换组织在这里签名，必须是同一个密钥来源。
     * `JwtModule.register({ secret: process.env.JWT_SECRET })` 在模块导入阶段求值，
     * 早于 ConfigModule 读 .env，会落到兜底密钥，导致 JwtStrategy 验签 401。
     */
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '7d' },
      }),
    }),
    UsersModule,
    OrganizationsModule,
    OrganizationContextModule,
    RolesModule,
    IdentityModule,
    AuditLogsModule,
  ],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: ORGANIZATION_REPOSITORY,
      useClass: OrganizationRepository,
    },
    {
      provide: EVENT_PUBLISHER,
      useExisting: EventBusService,
    },
    {
      provide: JWT_SERVICE,
      useClass: JwtService,
    },
    {
      provide: PASSWORD_SERVICE,
      useClass: PasswordService,
    },
    {
      provide: EFFECTIVE_PERMISSIONS_RESOLVER,
      useClass: EffectivePermissionsResolver,
    },
    UserRepository,
    OrganizationRepository,
    JwtService,
    PasswordService,
    EffectivePermissionsResolver,
    LoginService,
    SwitchOrganizationService,
    ValidateTokenService,
    GetProfileService,
  ],
  exports: [
    LoginService,
    SwitchOrganizationService,
    ValidateTokenService,
    GetProfileService,
    JWT_SERVICE,
    PASSWORD_SERVICE,
    EVENT_PUBLISHER,
  ],
})
export class AuthContextModule {}
