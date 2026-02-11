import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator'

export class CreateSettingDto {
  @IsString()
  theme: 'light' | 'dark'

  @IsString()
  language: string

  @IsString()
  timezone: string

  @IsString()
  dateFormat: string

  @IsString()
  timeFormat: string

  @IsNumber()
  @Min(5)
  @Max(100)
  pageSize: number

  @IsNumber()
  @Min(10)
  @Max(24)
  fontSize: number

  @IsBoolean()
  enableNotifications: boolean
}
