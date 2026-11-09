import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OrganizationMemberRole } from './organization-member-role.entity'
import { AuthSession } from './auth-session.entity'
import { AuthSessionsService } from './auth-sessions.service'
import { OrganizationMemberRolesService } from './organization-member-roles.service'

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationMemberRole, AuthSession])],
  providers: [OrganizationMemberRolesService, AuthSessionsService],
  exports: [OrganizationMemberRolesService, AuthSessionsService, TypeOrmModule],
})
export class IdentityModule {}
