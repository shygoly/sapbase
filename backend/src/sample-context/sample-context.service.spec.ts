import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { LabSample, LabSampleStatus } from './lab-sample.entity'
import { SampleContextService } from './sample-context.service'

describe('SampleContextService', () => {
  let service: SampleContextService
  let repository: jest.Mocked<Repository<LabSample>>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SampleContextService,
        {
          provide: getRepositoryToken(LabSample),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<SampleContextService>(SampleContextService)
    repository = module.get(getRepositoryToken(LabSample))
  })

  it('creates sample with organization scope and default status', async () => {
    const created = {
      sampleCode: 'S-001',
      quantity: 2,
      organizationId: 'org-1',
      status: LabSampleStatus.RECEIVED,
    } as LabSample

    repository.create.mockReturnValue(created)
    repository.save.mockResolvedValue(created)

    const result = await service.create({ sampleCode: 'S-001', quantity: 2 }, 'org-1')

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleCode: 'S-001',
        quantity: 2,
        organizationId: 'org-1',
        status: LabSampleStatus.RECEIVED,
      }),
    )
    expect(result).toEqual(created)
  })
})
