import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, MinLength, MaxLength, Matches } from 'class-validator'

export class CreateMenuItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string

  @IsOptional()
  @IsString()
  @Matches(/^\//, { message: 'Path must start with /' })
  path?: string

  @IsOptional()
  @IsString()
  icon?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[]

  @IsOptional()
  @IsBoolean()
  visible?: boolean = true

  @IsOptional()
  @IsNumber()
  order?: number = 0

  @IsOptional()
  @IsString()
  parentId?: string
}
