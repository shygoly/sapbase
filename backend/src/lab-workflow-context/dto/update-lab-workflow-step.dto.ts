import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class UpdateLabWorkflowStepDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  nextStep?: number

  @IsOptional()
  @IsString()
  stepNotes?: string
}
