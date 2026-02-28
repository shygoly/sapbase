import { IsEnum, IsOptional, IsString } from 'class-validator'
import { LabReportFormat } from '../lab-report.entity'

export class GenerateLabReportDto {
  @IsOptional()
  @IsEnum(LabReportFormat)
  format?: LabReportFormat

  @IsOptional()
  @IsString()
  language?: string
}
