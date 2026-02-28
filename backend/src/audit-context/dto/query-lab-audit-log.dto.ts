import { IsOptional, IsString } from 'class-validator'

export class QueryLabAuditLogDto {
  @IsOptional()
  @IsString()
  action?: string

  @IsOptional()
  @IsString()
  entityType?: string

  @IsOptional()
  @IsString()
  entityId?: string

  @IsOptional()
  @IsString()
  from?: string

  @IsOptional()
  @IsString()
  to?: string
}
