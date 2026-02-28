import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CreateLabReportDto } from './dto/create-lab-report.dto'
import { GenerateLabReportDto } from './dto/generate-lab-report.dto'
import { LabReport, LabReportFormat, LabReportStatus } from './lab-report.entity'

@Injectable()
export class ReportContextService {
  constructor(
    @InjectRepository(LabReport)
    private readonly reportRepository: Repository<LabReport>,
  ) {}

  async create(dto: CreateLabReportDto, organizationId: string): Promise<LabReport> {
    const report: LabReport = this.reportRepository.create({
      ...dto,
      sampleId: dto.sampleId ?? null,
      workflowExecutionId: dto.workflowExecutionId ?? null,
      templateName: dto.templateName ?? null,
      format: dto.format ?? LabReportFormat.PDF,
      language: dto.language ?? 'en',
      status: LabReportStatus.DRAFT,
      organizationId,
      generatedById: null,
      generatedAt: null,
      finalizedById: null,
      finalizedAt: null,
      metadata: null,
    })

    return this.reportRepository.save(report)
  }

  async list(organizationId: string, status?: LabReportStatus): Promise<LabReport[]> {
    return this.reportRepository.find({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      order: { createdAt: 'DESC' },
    })
  }

  async get(id: string, organizationId: string): Promise<LabReport> {
    const report = await this.reportRepository.findOne({ where: { id, organizationId } })
    if (!report) {
      throw new NotFoundException('Report not found')
    }
    return report
  }

  async generate(
    id: string,
    dto: GenerateLabReportDto,
    userId: string,
    organizationId: string,
  ): Promise<LabReport> {
    const report = await this.get(id, organizationId)

    if (report.status !== LabReportStatus.DRAFT) {
      throw new BadRequestException('Only draft reports can be generated')
    }

    report.status = LabReportStatus.GENERATED
    report.format = dto.format ?? report.format
    report.language = dto.language ?? report.language
    report.generatedById = userId
    report.generatedAt = new Date()
    report.metadata = {
      ...(report.metadata ?? {}),
      generationMode: 'native-context',
    }

    return this.reportRepository.save(report)
  }

  async finalize(id: string, userId: string, organizationId: string): Promise<LabReport> {
    const report = await this.get(id, organizationId)

    if (report.status !== LabReportStatus.GENERATED) {
      throw new BadRequestException('Only generated reports can be finalized')
    }

    report.status = LabReportStatus.FINALIZED
    report.finalizedById = userId
    report.finalizedAt = new Date()

    return this.reportRepository.save(report)
  }
}
