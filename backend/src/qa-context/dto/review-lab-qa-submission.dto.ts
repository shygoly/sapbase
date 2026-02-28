import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'
import { LabQaReviewDecision } from '../lab-qa-review.entity'

export class ReviewLabQaSubmissionDto {
  @IsUUID()
  submissionId: string

  @IsEnum(LabQaReviewDecision)
  decision: LabQaReviewDecision

  @IsOptional()
  @IsString()
  comments?: string

  @IsOptional()
  @IsString()
  signatureMethod?: string
}
