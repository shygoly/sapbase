import { IsString, IsOptional, IsUUID, IsObject } from 'class-validator'

export class CreateAuditLogDto {
  @IsString()
  action: string

  @IsString()
  resource: string

  @IsString()
  actor: string

  @IsString()
  status: 'success' | 'failure' | 'pending'

  @IsOptional()
  @IsUUID()
  resourceId?: string

  @IsOptional()
  @IsObject()
  changes?: Record<string, any>

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
