import { IsString, IsEmail, IsOptional, IsEnum, MinLength } from 'class-validator'

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
  @IsEnum(['active', 'inactive', 'suspended'])
  status?: 'active' | 'inactive' | 'suspended'
}
