import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { Organization } from '../organizations/organization.entity'
import { OrganizationMember } from '../organizations/organization-member.entity'
import { Invitation } from '../organizations/invitation.entity'
import { BrandConfig as BrandConfigOrm } from '../organizations/brand-config.entity'
import {
  ORGANIZATION_REPOSITORY,
  ORGANIZATION_MEMBER_REPOSITORY,
  INVITATION_REPOSITORY,
  BRAND_CONFIG_REPOSITORY,
  EVENT_PUBLISHER,
} from './domain/repositories'
import { OrganizationRepository } from './infrastructure/persistence/organization.repository'
import { OrganizationMemberRepository } from './infrastructure/persistence/organization-member.repository'
import { InvitationRepository } from './infrastructure/persistence/invitation.repository'
import { BrandConfigRepository } from './infrastructure/persistence/brand-config.repository'
import { EventBusService } from '../common/events'
import { CreateOrganizationService } from './application/services/create-organization.service'
import { AddMemberService } from './application/services/add-member.service'
import { InviteMemberService } from './application/services/invite-member.service'
import { AcceptInvitationService } from './application/services/accept-invitation.service'
import { RemoveMemberService } from './application/services/remove-member.service'
import { UpdateMemberRoleService } from './application/services/update-member-role.service'
import { UpdateOrganizationService } from './application/services/update-organization.service'
import { GetOrganizationService } from './application/services/get-organization.service'
import { GetMembersService } from './application/services/get-members.service'
import { CancelInvitationService } from './application/services/cancel-invitation.service'
import { GetInvitationsService } from './application/services/get-invitations.service'
import { GetInvitationByTokenService } from './application/services/get-invitation-by-token.service'
import { GetBrandConfigService } from './application/services/get-brand-config.service'
import { UpdateBrandConfigService } from './application/services/update-brand-config.service'
import { SUBSCRIPTION_SERVICE } from './domain/services'
import { StripeSubscriptionService } from './infrastructure/external/stripe-subscription.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, OrganizationMember, Invitation, BrandConfigOrm]),
    ConfigModule,
  ],
  // EventBusService is provided globally by EventBusModule
  providers: [
    {
      provide: ORGANIZATION_REPOSITORY,
      useClass: OrganizationRepository,
    },
    {
      provide: ORGANIZATION_MEMBER_REPOSITORY,
      useClass: OrganizationMemberRepository,
    },
    {
      provide: INVITATION_REPOSITORY,
      useClass: InvitationRepository,
    },
    {
      provide: BRAND_CONFIG_REPOSITORY,
      useClass: BrandConfigRepository,
    },
    {
      provide: EVENT_PUBLISHER,
      useExisting: EventBusService,
    },
    {
      provide: SUBSCRIPTION_SERVICE,
      useClass: StripeSubscriptionService,
    },
    OrganizationRepository,
    OrganizationMemberRepository,
    InvitationRepository,
    BrandConfigRepository,
    StripeSubscriptionService,
    CreateOrganizationService,
    AddMemberService,
    InviteMemberService,
    AcceptInvitationService,
    RemoveMemberService,
    UpdateMemberRoleService,
    UpdateOrganizationService,
    GetOrganizationService,
    GetMembersService,
    CancelInvitationService,
    GetInvitationsService,
    GetInvitationByTokenService,
    GetBrandConfigService,
    UpdateBrandConfigService,
  ],
  exports: [
    CreateOrganizationService,
    AddMemberService,
    InviteMemberService,
    AcceptInvitationService,
    RemoveMemberService,
    UpdateMemberRoleService,
    UpdateOrganizationService,
    GetOrganizationService,
    GetMembersService,
    CancelInvitationService,
    GetInvitationsService,
    GetInvitationByTokenService,
    GetBrandConfigService,
    UpdateBrandConfigService,
    SUBSCRIPTION_SERVICE,
    EVENT_PUBLISHER,
  ],
})
export class OrganizationContextModule {}
