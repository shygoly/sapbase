import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator'

export class CreateRoleDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  permissions?: string[]

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive'
}
