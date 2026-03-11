// Mock entity modules before any imports to break circular dependency chain
jest.mock('../../infrastructure/persistence/entities/ship.entity', () => ({ Ship: class Ship {} }))
jest.mock('../../infrastructure/persistence/entities/report-center-record.entity', () => ({ ReportCenterRecord: class ReportCenterRecord {} }))
jest.mock('../../infrastructure/persistence/repositories/report-center.repository', () => ({
  ReportCenterRepository: class ReportCenterRepository {},
}))
jest.mock('../../infrastructure/storage/report-file-storage.service', () => ({
  ReportFileStorageService: class ReportFileStorageService {},
}))
jest.mock('./reports.service', () => ({
  ReportsService: class ReportsService {},
}))

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ReportExportService } from './report-export.service'

describe('ReportExportService', () => {
  let service: ReportExportService
  let reportsService: { getReport: jest.Mock }
  let fileStorage: { buildFileName: jest.Mock; write: jest.Mock }
  let reportCenterRepository: { create: jest.Mock }
  let shipsRepo: { findOne: jest.Mock }

  const mockReport = {
    metrics: [{ label: 'CII Score', value: '85', trend: '+2%' }],
    rows: [{ year: 2024, value: 85 }],
  }

  const mockStoredFile = {
    fileName: 'cii-2024-vessel-a-ts.xlsx',
    filePath: '/uploads/shipping-reports/cii-2024-vessel-a-ts.xlsx',
    fileUrl: 'http://localhost:3051/uploads/shipping-reports/cii-2024-vessel-a-ts.xlsx',
  }

  const mockRecord = {
    id: 'record-1',
    organizationId: 'org-1',
    reportType: 'cii',
    vesselId: 'ship-1',
    vesselName: 'Vessel A',
    year: 2024,
    fileName: mockStoredFile.fileName,
    fileUrl: mockStoredFile.fileUrl,
    createdAt: new Date(),
  }

  beforeEach(async () => {
    shipsRepo = { findOne: jest.fn() }
    reportsService = { getReport: jest.fn() }
    fileStorage = { buildFileName: jest.fn(), write: jest.fn() }
    reportCenterRepository = { create: jest.fn() }

    const { Ship } = await import('../../infrastructure/persistence/entities/ship.entity')
    const { ReportsService } = await import('./reports.service')
    const { ReportFileStorageService } = await import('../../infrastructure/storage/report-file-storage.service')
    const { ReportCenterRepository } = await import('../../infrastructure/persistence/repositories/report-center.repository')

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportExportService,
        { provide: getRepositoryToken(Ship), useValue: shipsRepo },
        { provide: ReportsService, useValue: reportsService },
        { provide: ReportFileStorageService, useValue: fileStorage },
        { provide: ReportCenterRepository, useValue: reportCenterRepository },
      ],
    }).compile()

    service = module.get(ReportExportService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('exportReport', () => {
    const dto = {
      reportType: 'cii',
      vesselId: 'ship-1',
      year: 2024,
      fuelBasis: 'system',
      filters: { region: 'EU' },
    }

    beforeEach(() => {
      shipsRepo.findOne.mockResolvedValue({ id: 'ship-1', name: 'Vessel A', organizationId: 'org-1' })
      reportsService.getReport.mockResolvedValue(mockReport)
      fileStorage.buildFileName.mockReturnValue(mockStoredFile.fileName)
      fileStorage.write.mockResolvedValue(mockStoredFile)
      reportCenterRepository.create.mockResolvedValue(mockRecord)
    })

    it('generates workbook, writes to storage, and archives to report center', async () => {
      const result = await service.exportReport(dto as any, 'org-1', 'test-user')

      expect(reportsService.getReport).toHaveBeenCalledWith('cii', 'org-1', 'ship-1', 2024, 'system')
      expect(fileStorage.buildFileName).toHaveBeenCalledWith('cii', 2024, 'Vessel A')
      expect(fileStorage.write).toHaveBeenCalledWith(mockStoredFile.fileName, expect.any(Buffer))
      expect(reportCenterRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          reportType: 'cii',
          vesselId: 'ship-1',
          vesselName: 'Vessel A',
          year: 2024,
          exportedBy: 'test-user',
          parameters: { region: 'EU' },
          fileName: mockStoredFile.fileName,
          fileUrl: mockStoredFile.fileUrl,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      )
      expect(result.success).toBe(true)
      expect(result.archived).toEqual(mockRecord)
      expect(result.downloadUrl).toBe(`/api/shipping/report-center/${mockRecord.id}/download`)
    })

    it('handles missing vessel gracefully (no vesselId)', async () => {
      const dtoNoVessel = { reportType: 'cii', year: 2024 }
      reportsService.getReport.mockResolvedValue(mockReport)
      fileStorage.buildFileName.mockReturnValue('cii-2024-fleet-ts.xlsx')
      fileStorage.write.mockResolvedValue({ ...mockStoredFile, fileName: 'cii-2024-fleet-ts.xlsx' })
      reportCenterRepository.create.mockResolvedValue({ ...mockRecord, vesselId: undefined, vesselName: undefined })

      const result = await service.exportReport(dtoNoVessel as any, 'org-1')

      expect(shipsRepo.findOne).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('dual-writes: both storage write and repository create are called', async () => {
      await service.exportReport(dto as any, 'org-1', 'user-x')

      expect(fileStorage.write).toHaveBeenCalledTimes(1)
      expect(reportCenterRepository.create).toHaveBeenCalledTimes(1)
    })
  })
})
