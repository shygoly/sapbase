import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { LabMethod, LabMethodStatus } from './lab-method.entity'
import { LabMethodVersion } from './lab-method-version.entity'
import { CreateLabMethodDto } from './dto/create-lab-method.dto'
import { UpdateLabMethodDto } from './dto/update-lab-method.dto'
import { CreateLabMethodVersionDto } from './dto/create-lab-method-version.dto'

@Injectable()
export class MethodContextService {
  constructor(
    @InjectRepository(LabMethod)
    private readonly methodRepository: Repository<LabMethod>,
    @InjectRepository(LabMethodVersion)
    private readonly methodVersionRepository: Repository<LabMethodVersion>,
  ) {}

  async create(dto: CreateLabMethodDto, organizationId: string): Promise<LabMethod> {
    const method = this.methodRepository.create({
      ...dto,
      status: dto.status ?? LabMethodStatus.DRAFT,
      currentVersion: 1,
      organizationId,
    })

    const saved = await this.methodRepository.save(method)
    await this.methodVersionRepository.save(
      this.methodVersionRepository.create({
        methodId: saved.id,
        version: 1,
        versionStatus: 'active',
        definition: null,
        organizationId,
      }),
    )

    return saved
  }

  async findAll(organizationId: string, status?: LabMethodStatus): Promise<LabMethod[]> {
    return this.methodRepository.find({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string, organizationId: string): Promise<LabMethod> {
    const method = await this.methodRepository.findOne({
      where: { id, organizationId },
    })

    if (!method) {
      throw new NotFoundException('Method not found')
    }

    return method
  }

  async update(id: string, dto: UpdateLabMethodDto, organizationId: string): Promise<LabMethod> {
    const method = await this.findOne(id, organizationId)
    Object.assign(method, dto)
    return this.methodRepository.save(method)
  }

  async createVersion(
    methodId: string,
    dto: CreateLabMethodVersionDto,
    organizationId: string,
  ): Promise<LabMethodVersion> {
    const method = await this.findOne(methodId, organizationId)
    const nextVersion = method.currentVersion + 1

    const version = this.methodVersionRepository.create({
      methodId,
      version: nextVersion,
      versionStatus: dto.versionStatus ?? 'active',
      definition: dto.definition ?? null,
      organizationId,
    })

    method.currentVersion = nextVersion
    await this.methodRepository.save(method)

    return this.methodVersionRepository.save(version)
  }

  async getVersions(methodId: string, organizationId: string): Promise<LabMethodVersion[]> {
    await this.findOne(methodId, organizationId)

    return this.methodVersionRepository.find({
      where: { methodId, organizationId },
      order: { version: 'DESC' },
    })
  }
}
