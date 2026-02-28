import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateLabSampleDto {
  @IsString()
  sampleCode: string

  @IsOptional()
  @IsString()
  customerCode?: string

  @IsOptional()
  @IsString()
  projectCode?: string

  @IsOptional()
  @IsString()
  batchNumber?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  sampleType?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number
}
