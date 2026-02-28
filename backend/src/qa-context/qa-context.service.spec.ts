import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SampleContextService } from '../sample-context/sample-context.service'
import { LabSampleStatus } from '../sample-context/lab-sample.entity'
import { LabQaReviewDecision } from './lab-qa-review.entity'
import { LabQaReview } from './lab-qa-review.entity'
import { LabQaSubmission, LabQaSubmissionStatus } from './lab-qa-submission.entity'
import { QaContextService } from './qa-context.service'

describe('QaContextService', () => {
  let service: QaContextService
  let submissionRepository: jest.Mocked<Repository<LabQaSubmission>>
  let reviewRepository: jest.Mocked<Repository<LabQaReview>>
  let sampleService: jest.Mocked<SampleContextService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QaContextService,
        {
          provide: getRepositoryToken(LabQaSubmission),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LabQaReview),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: SampleContextService,
          useValue: {
            updateStatus: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<QaContextService>(QaContextService)
    submissionRepository = module.get(getRepositoryToken(LabQaSubmission))
    reviewRepository = module.get(getRepositoryToken(LabQaReview))
    sampleService = module.get(SampleContextService)
  })

  it('approves submission and updates sample status to reporting', async () => {
    const submission = {
      id: 'sub-1',
      sampleId: 'sample-1',
      status: LabQaSubmissionStatus.PENDING,
      organizationId: 'org-1',
    } as LabQaSubmission

    const review = {
      id: 'review-1',
      submissionId: 'sub-1',
      decision: LabQaReviewDecision.APPROVE,
    } as LabQaReview

    submissionRepository.findOne.mockResolvedValue(submission)
    submissionRepository.save.mockResolvedValue(submission)
    reviewRepository.create.mockReturnValue(review)
    reviewRepository.save.mockResolvedValue(review)

    const result = await service.review(
      {
        submissionId: 'sub-1',
        decision: LabQaReviewDecision.APPROVE,
      },
      'user-1',
      'org-1',
    )

    expect(sampleService.updateStatus).toHaveBeenCalledWith('sample-1', LabSampleStatus.REPORTING, 'org-1')
    expect(result).toEqual(review)
  })
})
