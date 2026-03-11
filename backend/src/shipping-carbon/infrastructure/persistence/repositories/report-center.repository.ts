import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ReportCenterRecord } from '../entities/report-center-record.entity'
import { determineReportCenterFilters } from '../../../report-center-filter'
import { ReportCenterQueryDto } from '../../../dto/report-center-query.dto'

@Injectable()
export class ReportCenterRepository {
  constructor(
    @InjectRepository(ReportCenterRecord)
    private readonly repo: Repository<ReportCenterRecord>,
  ) {}

  async findAll(query: ReportCenterQueryDto, organizationId: string): Promise<ReportCenterRecord[]> {
    const filters = determineReportCenterFilters(query)
    const qb = this.repo.createQueryBuilder('record')
      .where('record.organizationId = :organizationId', { organizationId })
    if (filters.reportType) qb.andWhere('record.reportType = :reportType', { reportType: filters.reportType })
    if (filters.vesselId) qb.andWhere('record.vesselId = :vesselId', { vesselId: filters.vesselId })
    if (filters.year) qb.andWhere('record.year = :year', { year: filters.year })
    return qb.orderBy('record.createdAt', 'DESC').getMany()
  }

  async findOne(id: string, organizationId: string): Promise<ReportCenterRecord | null> {
    return this.repo.findOne({ where: { id, organizationId } })
  }

  async create(data: Partial<ReportCenterRecord>): Promise<ReportCenterRecord> {
    const record = this.repo.create(data)
    return this.repo.save(record)
  }
}
