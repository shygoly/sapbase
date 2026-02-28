import { Test, TestingModule } from '@nestjs/testing'
import { PharmanaCompatController } from './pharmana-compat.controller'
import { SampleContextService } from '../sample-context/sample-context.service'
import { MethodContextService } from '../method-context/method-context.service'
import { LabWorkflowContextService } from '../lab-workflow-context/lab-workflow-context.service'
import { QaContextService } from '../qa-context/qa-context.service'
import { ReportContextService } from '../report-context/report-context.service'
import { AuditContextService } from '../audit-context/audit-context.service'

describe('PharmanaCompatController report/audit parity', () => {
  let controller: PharmanaCompatController
  let reportService: jest.Mocked<ReportContextService>
  let auditService: jest.Mocked<AuditContextService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PharmanaCompatController],
      providers: [
        { provide: SampleContextService, useValue: {} },
        { provide: MethodContextService, useValue: {} },
        { provide: LabWorkflowContextService, useValue: {} },
        { provide: QaContextService, useValue: {} },
        {
          provide: ReportContextService,
          useValue: {
            list: jest.fn(),
            get: jest.fn(),
            generate: jest.fn(),
            finalize: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: AuditContextService,
          useValue: {
            query: jest.fn(),
            append: jest.fn(),
            exportCsv: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get(PharmanaCompatController)
    reportService = module.get(ReportContextService)
    auditService = module.get(AuditContextService)
  })

  it('compat reports route delegates to report context', async () => {
    const reports = [{ id: 'r1', title: 'R1' }]
    reportService.list.mockResolvedValue(reports as any)

    const result = await controller.listReports('org-1', {})

    expect(reportService.list).toHaveBeenCalledWith('org-1', undefined)
    expect(result).toEqual(reports)
  })

  it('compat audit route delegates to audit context', async () => {
    const logs = [{ id: 'a1', action: 'X' }]
    auditService.query.mockResolvedValue(logs as any)

    const result = await controller.queryAuditLogs({}, 'org-1')

    expect(auditService.query).toHaveBeenCalledWith({}, 'org-1')
    expect(result).toEqual(logs)
  })
})
