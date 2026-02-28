import { IsOptional, IsString, IsUUID } from 'class-validator'

export class CreateLabQaSubmissionDto {
  @IsUUID()
  sampleId: string

  @IsUUID()
  methodId: string

  @IsUUID()
  workflowExecutionId: string

  @IsOptional()
  @IsString()
  submissionComment?: string
}
