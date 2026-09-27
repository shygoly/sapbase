import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { YearParameter } from '../../infrastructure/persistence/entities/year-parameter.entity'
import { CreateYearParameterDto } from '../../dto/create-year-parameter.dto'
import { UpdateYearParameterDto } from '../../dto/update-year-parameter.dto'

@Injectable()
export class YearParametersService {
  constructor(
    @InjectRepository(YearParameter)
    private readonly repo: Repository<YearParameter>,
  ) {}

  async findAll(): Promise<YearParameter[]> {
    return this.repo.find({ order: { year: 'ASC' } })
  }

  async create(dto: CreateYearParameterDto): Promise<YearParameter> {
    const existing = await this.repo.findOne({ where: { year: dto.year } })
    if (existing) {
      throw new ConflictException(`Year ${dto.year} already exists`)
    }
    const entity = this.repo.create(dto)
    return this.repo.save(entity)
  }

  async update(id: string, dto: UpdateYearParameterDto): Promise<YearParameter> {
    const entity = await this.repo.findOne({ where: { id } })
    if (!entity) {
      throw new NotFoundException(`Year parameter ${id} not found`)
    }
    if (dto.year !== undefined) {
      const existing = await this.repo.findOne({ where: { year: dto.year } })
      if (existing && existing.id !== id) {
        throw new ConflictException(`Year ${dto.year} already exists`)
      }
    }
    Object.assign(entity, dto)
    return this.repo.save(entity)
  }

  async delete(id: string): Promise<void> {
    const result = await this.repo.delete({ id })
    if (result.affected === 0) {
      throw new NotFoundException(`Year parameter ${id} not found`)
    }
  }
}
