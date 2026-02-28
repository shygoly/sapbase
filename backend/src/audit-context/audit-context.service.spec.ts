import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditContextService } from './audit-context.service'
import { LabAuditLog } from './lab-audit-log.entity'

describe('AuditContextService', () => {
  let service: AuditContextService
  let repository: jest.Mocked<Repository<LabAuditLog>>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditContextService,
        {
          provide: getRepositoryToken(LabAuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<AuditContextService>(AuditContextService)
    repository = module.get(getRepositoryToken(LabAuditLog))
  })

  it('appends immutable log with digest', async () => {
    const created = {
      id: 'a1',
      action: 'REPORT_GENERATED',
      entityType: 'Report',
      entityId: 'r1',
      digest: 'abc',
      eventAt: new Date(),
    } as unknown as LabAuditLog

    repository.create.mockReturnValue(created)
    repository.save.mockResolvedValue(created)

    const result = await service.append(
      { action: 'REPORT_GENERATED', entityType: 'Report', entityId: 'r1' },
      'u1',
      'org-1',
    )

    expect(repository.create).toHaveBeenCalled()
    expect(result.entityType).toBe('Report')
  })

  it('filters by entityType and entityId', async () => {
    const logs = [
      { id: 'a2', entityType: 'Report', entityId: 'r2', eventAt: new Date() },
    ] as unknown as LabAuditLog[]

    repository.find.mockResolvedValue(logs)

    const result = await service.query(
      { entityType: 'Report', entityId: 'r2' },
      'org-1',
    )

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          entityType: 'Report',
          entityId: 'r2',
        }),
      }),
    )
    expect(result).toEqual(logs)
  })
})
