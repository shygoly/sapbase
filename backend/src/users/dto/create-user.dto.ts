import { IsString, IsEmail, IsOptional, IsEnum, IsArray, MinLength } from 'class-validator'
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

  /**
   * 权限点的授予面（含 `tool:*`）。由既有 `@Roles('Admin','Manager')` 守卫写路径；
   * `users.permissions` 是 JWT 里 `permissions` 的来源，不要另造 `/permissions/grant`。
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[]
}
