import { IsString, IsOptional, IsEnum } from 'class-validator'

export class CreateDepartmentDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  managerId?: string

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive'
}
