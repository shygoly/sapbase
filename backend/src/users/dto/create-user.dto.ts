import { IsString, IsEmail, IsOptional, IsEnum, MinLength } from 'class-validator'
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
  @IsString()
  role?: string

  @IsOptional()
  @IsString()
  department?: string

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus
}
