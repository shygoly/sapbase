import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { LabReport, LabReportStatus } from './lab-report.entity'
import { ReportContextService } from './report-context.service'

describe('ReportContextService', () => {
  let service: ReportContextService
  let repository: jest.Mocked<Repository<LabReport>>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportContextService,
        {
          provide: getRepositoryToken(LabReport),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<ReportContextService>(ReportContextService)
    repository = module.get(getRepositoryToken(LabReport))
  })

  it('moves report from draft to generated', async () => {
    const report = {
      id: 'r1',
      organizationId: 'org-1',
      status: LabReportStatus.DRAFT,
      format: 'pdf',
      language: 'en',
      metadata: null,
    } as unknown as LabReport

    repository.findOne.mockResolvedValue(report)
    repository.save.mockImplementation(async (value) => value as LabReport)

    const result = await service.generate('r1', {}, 'u1', 'org-1')

    expect(result.status).toBe(LabReportStatus.GENERATED)
    expect(result.generatedById).toBe('u1')
  })

  it('moves report from generated to finalized', async () => {
    const report = {
      id: 'r2',
      organizationId: 'org-1',
      status: LabReportStatus.GENERATED,
    } as unknown as LabReport

    repository.findOne.mockResolvedValue(report)
    repository.save.mockImplementation(async (value) => value as LabReport)

    const result = await service.finalize('r2', 'u2', 'org-1')

    expect(result.status).toBe(LabReportStatus.FINALIZED)
    expect(result.finalizedById).toBe('u2')
  })
})
