import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { LabSample, LabSampleStatus } from './lab-sample.entity'
import { CreateLabSampleDto } from './dto/create-lab-sample.dto'
import { UpdateLabSampleDto } from './dto/update-lab-sample.dto'

@Injectable()
export class SampleContextService {
  constructor(
    @InjectRepository(LabSample)
    private readonly sampleRepository: Repository<LabSample>,
  ) {}

  async create(dto: CreateLabSampleDto, organizationId: string): Promise<LabSample> {
    const sample = this.sampleRepository.create({
      ...dto,
      quantity: dto.quantity ?? 0,
      status: LabSampleStatus.RECEIVED,
      organizationId,
    })

    return this.sampleRepository.save(sample)
  }

  async findAll(organizationId: string, status?: LabSampleStatus): Promise<LabSample[]> {
    return this.sampleRepository.find({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string, organizationId: string): Promise<LabSample> {
    const sample = await this.sampleRepository.findOne({
      where: { id, organizationId },
    })

    if (!sample) {
      throw new NotFoundException('Sample not found')
    }

    return sample
  }

  async update(id: string, dto: UpdateLabSampleDto, organizationId: string): Promise<LabSample> {
    const sample = await this.findOne(id, organizationId)
    Object.assign(sample, dto)
    return this.sampleRepository.save(sample)
  }

  async updateStatus(id: string, status: LabSampleStatus, organizationId: string): Promise<LabSample> {
    const sample = await this.findOne(id, organizationId)
    sample.status = status
    return this.sampleRepository.save(sample)
  }

  async assignMethod(
    id: string,
    assignedMethodId: string,
    assignedAnalystId: string | undefined,
    organizationId: string,
  ): Promise<LabSample> {
    const sample = await this.findOne(id, organizationId)
    sample.assignedMethodId = assignedMethodId
    sample.assignedAnalystId = assignedAnalystId ?? null
    sample.status = LabSampleStatus.IN_ANALYSIS
    return this.sampleRepository.save(sample)
  }
}
