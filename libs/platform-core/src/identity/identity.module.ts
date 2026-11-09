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
import { ServiceClient } from './service-client.entity'
import { OrganizationMemberRolesService } from './organization-member-roles.service'

@Module({
  imports: [TypeOrmModule.forFeature([
      OrganizationMemberRole,
      AuthSession,
      IdentityProvider,
      AuthLoginEvent,
      ServiceClient,
    ])],
  controllers: [IdentityController],
  providers: [
    OrganizationMemberRolesService,
    AuthSessionsService,
    IdentityProvidersService,
    AuthLoginEventsService,
    ServiceClientsService,
    ServiceClientAuthGuard,
  ],
  exports: [
    OrganizationMemberRolesService,
    AuthSessionsService,
    IdentityProvidersService,
    AuthLoginEventsService,
    ServiceClientsService,
    ServiceClientAuthGuard,
    TypeOrmModule,
  ],
})
export class IdentityModule {}
