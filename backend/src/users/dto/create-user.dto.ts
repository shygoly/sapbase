import { IsString, IsEmail, IsOptional, IsEnum, MinLength, IsUUID } from 'class-validator'
import { UserStatus } from '@speckit/shared-schemas'

export class CreateUserDto {
  @IsString()
  name: string

  @IsEmail()
  email: string

  @IsString()
  @MinLength(8)
  password: string

  @IsOptional()
  @IsUUID()
  roleId?: string

  @IsOptional()
  @IsUUID()
  departmentId?: string

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus
}
