import { IsString, IsOptional, IsUUID, IsNumber, Min } from 'class-validator'

export class AuditLogFilterDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string

  @IsOptional()
  @IsString()
  source?: string

  @IsOptional()
  @IsString()
  actorType?: string

  @IsOptional()
  @IsString()
  correlationId?: string

  @IsOptional()
  @IsString()
  status?: 'success' | 'failure' | 'pending'

  @IsOptional()
  @IsString()
  actor?: string

  @IsOptional()
  @IsString()
  action?: string

  @IsOptional()
  @IsString()
  resource?: string

  @IsOptional()
  @IsUUID()
  resourceId?: string

  @IsOptional()
  @IsString()
  startDate?: string

  @IsOptional()
  @IsString()
  endDate?: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @IsNumber()
  @Min(1)
  pageSize?: number = 10
}
