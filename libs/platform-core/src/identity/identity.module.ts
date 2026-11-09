import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OrganizationMemberRole } from './organization-member-role.entity'
import { AuthSession } from './auth-session.entity'
import { IdentityProvider } from './identity-provider.entity'
import { AuthLoginEvent } from './auth-login-event.entity'
import { AuthSessionsService } from './auth-sessions.service'
import { IdentityProvidersService } from './identity-providers.service'
import { AuthLoginEventsService } from './auth-login-events.service'
import { IdentityController } from './identity.controller'
import { ServiceClientsService } from './service-clients.service'
import { ServiceClientAuthGuard } from './service-client-auth.guard'
import { IdentitySsoService } from './identity-sso.service'
import { IdentitySsoController } from './identity-sso.controller'
import { IdentityLink } from './identity-link.entity'
import { UsersModule } from '../users/users.module'
import { RolesModule } from '../roles/roles.module'
import { ServiceClient } from './service-client.entity'
import { OrganizationMemberRolesService } from './organization-member-roles.service'

@Module({
  imports: [
    UsersModule,
    RolesModule,
    TypeOrmModule.forFeature([
      OrganizationMemberRole,
      AuthSession,
      IdentityProvider,
      AuthLoginEvent,
      ServiceClient,
      IdentityLink,
    ])],
  controllers: [IdentityController, IdentitySsoController],
  providers: [
    OrganizationMemberRolesService,
    AuthSessionsService,
    IdentityProvidersService,
    AuthLoginEventsService,
    ServiceClientsService,
    ServiceClientAuthGuard,
    IdentitySsoService,
  ],
  exports: [
    OrganizationMemberRolesService,
    AuthSessionsService,
    IdentityProvidersService,
    AuthLoginEventsService,
    ServiceClientsService,
    ServiceClientAuthGuard,
    IdentitySsoService,
    TypeOrmModule,
  ],
})
export class IdentityModule {}
