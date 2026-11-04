import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator'

export class UpdateSettingDto {
  @IsOptional()
  @IsString()
  theme?: 'light' | 'dark'

  @IsOptional()
  @IsString()
  language?: string

  @IsOptional()
  @IsString()
  timezone?: string

  @IsOptional()
  @IsString()
  dateFormat?: string

  @IsOptional()
  @IsString()
  timeFormat?: string

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(100)
  pageSize?: number

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(24)
  fontSize?: number

  @IsOptional()
  @IsBoolean()
  enableNotifications?: boolean
}
