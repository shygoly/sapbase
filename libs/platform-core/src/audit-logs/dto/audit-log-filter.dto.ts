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

  /** 法律保留过滤：'true' / 'false'，用字符串接收 query 避免隐式转型 */
  @IsOptional()
  @IsString()
  legalHold?: string

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
