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
import { IdentitySourceAdapterRegistry } from './identity-source'
import { IdentitySyncService } from './identity-sync.service'
import { IdentitySyncController } from './identity-sync.controller'
import { DelegatedIdentityService } from './delegated-identity.service'
import { createSsoAdapter, SSO_ADAPTER_FACTORY } from './sso/adapter-factory'
import { OrganizationsModule } from '../organizations/organizations.module'
import { EffectivePermissionsService } from '../roles/effective-permissions.service'
import { IdentityLink } from './identity-link.entity'
import { IdentitySyncRun } from './identity-sync-run.entity'
import { UsersModule } from '../users/users.module'
import { RolesModule } from '../roles/roles.module'
import { ServiceClient } from './service-client.entity'
import { OrganizationMemberRolesService } from './organization-member-roles.service'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'

@Module({
  imports: [
    UsersModule,
    RolesModule,
    OrganizationsModule,
    AuditLogsModule,
    TypeOrmModule.forFeature([
      OrganizationMemberRole,
      AuthSession,
      IdentityProvider,
      AuthLoginEvent,
      ServiceClient,
      IdentityLink,
      IdentitySyncRun,
    ])],
  controllers: [IdentityController, IdentitySsoController, IdentitySyncController],
  providers: [
    OrganizationMemberRolesService,
    AuthSessionsService,
    IdentityProvidersService,
    AuthLoginEventsService,
    ServiceClientsService,
    ServiceClientAuthGuard,
    IdentitySsoService,
    IdentitySourceAdapterRegistry,
    IdentitySyncService,
    DelegatedIdentityService,
    EffectivePermissionsService,
    { provide: SSO_ADAPTER_FACTORY, useValue: createSsoAdapter },
  ],
  exports: [
    OrganizationMemberRolesService,
    AuthSessionsService,
    IdentityProvidersService,
    AuthLoginEventsService,
    ServiceClientsService,
    ServiceClientAuthGuard,
    IdentitySsoService,
    IdentitySourceAdapterRegistry,
    IdentitySyncService,
    DelegatedIdentityService,
    TypeOrmModule,
  ],
})
export class IdentityModule {}
