import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OrganizationMemberRole } from './organization-member-role.entity'
import { OrganizationMemberRolesService } from './organization-member-roles.service'

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationMemberRole])],
  providers: [OrganizationMemberRolesService],
  exports: [OrganizationMemberRolesService, TypeOrmModule],
})
export class IdentityModule {}
