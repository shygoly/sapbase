import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SampleContextService } from '../sample-context/sample-context.service'
import { LabSampleStatus } from '../sample-context/lab-sample.entity'
import { CreateLabQaSubmissionDto } from './dto/create-lab-qa-submission.dto'
import { ReviewLabQaSubmissionDto } from './dto/review-lab-qa-submission.dto'
import { LabQaSubmission, LabQaSubmissionStatus } from './lab-qa-submission.entity'
import { LabQaReview } from './lab-qa-review.entity'

@Injectable()
export class QaContextService {
  constructor(
    @InjectRepository(LabQaSubmission)
    private readonly submissionRepository: Repository<LabQaSubmission>,
    @InjectRepository(LabQaReview)
    private readonly reviewRepository: Repository<LabQaReview>,
    private readonly sampleService: SampleContextService,
  ) {}

  async submit(
    dto: CreateLabQaSubmissionDto,
    submittedById: string,
    organizationId: string,
  ): Promise<LabQaSubmission> {
    await this.sampleService.updateStatus(dto.sampleId, LabSampleStatus.IN_REVIEW, organizationId)

    const submission = this.submissionRepository.create({
      ...dto,
      submittedById,
      submissionComment: dto.submissionComment ?? null,
      status: LabQaSubmissionStatus.PENDING,
      organizationId,
    })

    return this.submissionRepository.save(submission)
  }

  async getReviewQueue(organizationId: string): Promise<LabQaSubmission[]> {
    return this.submissionRepository.find({
      where: {
        organizationId,
        status: LabQaSubmissionStatus.PENDING,
      },
      order: { submittedAt: 'ASC' },
    })
  }

  async review(
    dto: ReviewLabQaSubmissionDto,
    reviewerId: string,
    organizationId: string,
  ): Promise<LabQaReview> {
    const submission = await this.submissionRepository.findOne({
      where: {
        id: dto.submissionId,
        organizationId,
      },
    })

    if (!submission) {
      throw new NotFoundException('Submission not found')
    }

    submission.status = dto.decision === 'approve'
      ? LabQaSubmissionStatus.APPROVED
      : LabQaSubmissionStatus.REJECTED

    await this.submissionRepository.save(submission)

    await this.sampleService.updateStatus(
      submission.sampleId,
      dto.decision === 'approve' ? LabSampleStatus.REPORTING : LabSampleStatus.IN_ANALYSIS,
      organizationId,
    )

    const review = this.reviewRepository.create({
      submissionId: submission.id,
      reviewerId,
      decision: dto.decision,
      comments: dto.comments ?? null,
      signatureMethod: dto.signatureMethod ?? null,
      organizationId,
    })

    return this.reviewRepository.save(review)
  }
}
