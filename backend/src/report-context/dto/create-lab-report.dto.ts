import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'
import { LabReportFormat } from '../lab-report.entity'

export class CreateLabReportDto {
  @IsString()
  title: string

  @IsOptional()
  @IsUUID()
  sampleId?: string

  @IsOptional()
  @IsUUID()
  workflowExecutionId?: string

  @IsOptional()
  @IsEnum(LabReportFormat)
  format?: LabReportFormat

  @IsOptional()
  @IsString()
  language?: string

  @IsOptional()
  @IsString()
  templateName?: string
}
