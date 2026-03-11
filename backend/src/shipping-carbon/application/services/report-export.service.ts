import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Ship } from '../../infrastructure/persistence/entities/ship.entity'
import { ReportCenterRepository } from '../../infrastructure/persistence/repositories/report-center.repository'
import { ReportFileStorageService } from '../../infrastructure/storage/report-file-storage.service'
import { ExportReportDto } from '../../dto/export-report.dto'
import { buildReportWorkbookBuffer } from '../../report-export'
import { ReportsService } from './reports.service'

@Injectable()
export class ReportExportService {
  constructor(
    @InjectRepository(Ship) private readonly shipsRepo: Repository<Ship>,
    private readonly reportsService: ReportsService,
    private readonly fileStorage: ReportFileStorageService,
    private readonly reportCenterRepository: ReportCenterRepository,
  ) {}

  async exportReport(dto: ExportReportDto, organizationId: string, exportedBy?: string) {
    const ship = dto.vesselId ? await this.shipsRepo.findOne({ where: { id: dto.vesselId, organizationId } }) : null
    const normalizedReportType = dto.reportType.replace(/_/g, '-')
    const report = await this.reportsService.getReport(normalizedReportType, organizationId, dto.vesselId, dto.year, dto.fuelBasis)
    const workbookBuffer = buildReportWorkbookBuffer(
      dto.reportType,
      report.metrics.map((m) => ({ label: m.label, value: m.value, trend: m.trend || '' })),
      report.rows,
    )
    const fileName = this.fileStorage.buildFileName(dto.reportType, dto.year, ship?.name)
    const { fileUrl } = await this.fileStorage.write(fileName, workbookBuffer)
    const saved = await this.reportCenterRepository.create({
      organizationId, reportType: dto.reportType, vesselId: dto.vesselId, vesselName: ship?.name,
      year: dto.year, exportedBy, parameters: dto.filters || {}, fileName, fileUrl,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    return { success: true, archived: saved, downloadUrl: `/api/shipping/report-center/${saved.id}/download` }
  }
}
