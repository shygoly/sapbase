import { IsInt, IsOptional, IsUUID, Min } from 'class-validator'

export class CreateLabWorkflowExecutionDto {
  @IsUUID()
  sampleId: string

  @IsUUID()
  methodId: string

  @IsOptional()
  @IsUUID()
  assignedAnalystId?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  plannedSteps?: number
}
