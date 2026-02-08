import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator'

export class CreateUserDto {
  @IsString()
  name: string

  @IsEmail()
  email: string

  @IsOptional()
  @IsString()
  role?: string

  @IsOptional()
  @IsString()
  department?: string

  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended'])
  status?: 'active' | 'inactive' | 'suspended'
}
