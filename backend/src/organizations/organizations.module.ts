import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsService } from './organizations.service'
import { InvitationsController } from './invitations.controller'
import { InvitationsPublicController } from './invitations-public.controller'
import { InvitationsService } from './invitations.service'
import { SubscriptionsController } from './subscriptions.controller'
import { StripeService } from './stripe.service'
import { Organization } from './organization.entity'
import { OrganizationMember } from './organization-member.entity'
import { Invitation } from './invitation.entity'
import { OrganizationActivity } from './organization-activity.entity'
import { User } from '../users/user.entity'
import { TenantContextMiddleware } from './middleware/tenant-context.middleware'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, OrganizationMember, Invitation, OrganizationActivity, User]),
    JwtModule.register({}),
    ConfigModule,
  ],
  controllers: [OrganizationsController, InvitationsController, InvitationsPublicController, SubscriptionsController],
  providers: [OrganizationsService, InvitationsService, StripeService, TenantContextMiddleware],
  exports: [OrganizationsService, InvitationsService, StripeService],
})
export class OrganizationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*')
  }
}
