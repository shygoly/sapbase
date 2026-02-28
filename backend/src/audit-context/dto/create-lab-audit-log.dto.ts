import { IsObject, IsOptional, IsString } from 'class-validator'

export class CreateLabAuditLogDto {
  @IsString()
  action: string

  @IsString()
  entityType: string

  @IsString()
  entityId: string

  @IsOptional()
  @IsString()
  message?: string

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>
}
