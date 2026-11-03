import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from './user.entity'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { Role } from '../roles/role.entity'
import { Department } from '../departments/department.entity'
import { OrganizationMember } from '../organizations/organization-member.entity'

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Department, OrganizationMember])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
