import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CiiShipTypeParameter } from '../../infrastructure/persistence/entities/cii-ship-type-parameter.entity'
import { CreateCiiShipTypeParameterDto } from '../../dto/create-cii-ship-type-parameter.dto'
import { UpdateCiiShipTypeParameterDto } from '../../dto/update-cii-ship-type-parameter.dto'

@Injectable()
export class CiiShipTypeParametersService {
  constructor(
    @InjectRepository(CiiShipTypeParameter)
    private readonly repo: Repository<CiiShipTypeParameter>,
  ) {}

  async findAll(): Promise<CiiShipTypeParameter[]> {
    return this.repo.find({
      order: { shipType: 'ASC', applicableStandard: 'ASC', rangeMin: 'ASC' },
    })
  }

  private async checkOverlap(
    shipType: string,
    applicableStandard: string,
    rangeMin: number,
    rangeMax: number | null,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.shipType = :shipType', { shipType })
      .andWhere('p.applicableStandard = :applicableStandard', {
        applicableStandard: applicableStandard || 'DWT',
      })
    if (excludeId) {
      qb.andWhere('p.id != :excludeId', { excludeId })
    }
    const existing = await qb.getMany()
    const rMax = rangeMax ?? Number.MAX_SAFE_INTEGER
    for (const e of existing) {
      const eMax = e.rangeMax ?? Number.MAX_SAFE_INTEGER
      if (rangeMin < eMax && rMax > e.rangeMin) {
        throw new BadRequestException(
          `Range [${rangeMin}, ${rangeMax ?? '∞'}] overlaps with existing [${e.rangeMin}, ${e.rangeMax ?? '∞'}]`,
        )
      }
    }
  }

  async create(dto: CreateCiiShipTypeParameterDto): Promise<CiiShipTypeParameter> {
    const standard = dto.applicableStandard ?? 'DWT'
    await this.checkOverlap(
      dto.shipType,
      standard,
      dto.rangeMin,
      dto.rangeMax ?? null,
    )
    const payload: Partial<CiiShipTypeParameter> = {
      shipType: dto.shipType,
      applicableStandard: standard,
      rangeMin: dto.rangeMin,
      rangeMax: dto.rangeMax ?? undefined,
      referenceCii: dto.referenceCii,
      requiredCii: dto.requiredCii,
      d1: dto.d1,
      d2: dto.d2,
      d3: dto.d3,
      d4: dto.d4,
      correctionFactor: dto.correctionFactor,
      constantCapacity: dto.constantCapacity ?? undefined,
      useMax: dto.useMax ?? false,
    }
    const entity = this.repo.create(payload)
    return this.repo.save(entity) as Promise<CiiShipTypeParameter>
  }

  async update(id: string, dto: UpdateCiiShipTypeParameterDto): Promise<CiiShipTypeParameter> {
    const entity = await this.repo.findOne({ where: { id } })
    if (!entity) {
      throw new NotFoundException(`CII ship type parameter ${id} not found`)
    }
    const shipType = dto.shipType ?? entity.shipType
    const standard = dto.applicableStandard ?? entity.applicableStandard
    const rangeMin = dto.rangeMin ?? entity.rangeMin
    const rangeMax = dto.rangeMax !== undefined ? dto.rangeMax : entity.rangeMax
    await this.checkOverlap(shipType, standard, rangeMin, rangeMax ?? null, id)
    Object.assign(entity, dto)
    return this.repo.save(entity)
  }

  async delete(id: string): Promise<void> {
    const result = await this.repo.delete({ id })
    if (result.affected === 0) {
      throw new NotFoundException(`CII ship type parameter ${id} not found`)
    }
  }
}
