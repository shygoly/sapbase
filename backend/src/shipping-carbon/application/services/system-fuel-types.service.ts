import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { SystemFuelType } from '../../infrastructure/persistence/entities/system-fuel-type.entity'
import { TenantFuelType } from '../../infrastructure/persistence/entities/tenant-fuel-type.entity'
import { CreateSystemFuelTypeDto } from '../../dto/create-system-fuel-type.dto'
import { UpdateSystemFuelTypeDto } from '../../dto/update-system-fuel-type.dto'

export type FuelTypeRecord = (SystemFuelType | TenantFuelType) & { scope?: 'system' | 'tenant' }

@Injectable()
export class SystemFuelTypesService {
  constructor(
    @InjectRepository(SystemFuelType)
    private readonly systemRepo: Repository<SystemFuelType>,
    @InjectRepository(TenantFuelType)
    private readonly tenantRepo: Repository<TenantFuelType>,
  ) {}

  async findAll(organizationId: string): Promise<FuelTypeRecord[]> {
    const [systemFuels, tenantFuels] = await Promise.all([
      this.systemRepo.find({ order: { name: 'ASC' } }),
      this.tenantRepo.find({
        where: { organizationId },
        order: { name: 'ASC' },
      }),
    ])
    const systemWithScope = systemFuels.map((f) => ({ ...f, scope: 'system' as const }))
    const tenantWithScope = tenantFuels.map((f) => ({ ...f, scope: 'tenant' as const, defaultPrice: f.price }))
    return [...systemWithScope, ...tenantWithScope]
  }

  async create(organizationId: string, dto: CreateSystemFuelTypeDto): Promise<SystemFuelType | TenantFuelType> {
    const scope = dto.scope ?? 'tenant'
    if (scope === 'system') {
      const entity = this.systemRepo.create({
        name: dto.name,
        code: dto.code,
        lcv: dto.lcv,
        wellToTankFactor: dto.wellToTankFactor,
        tankToWakeFactor: dto.tankToWakeFactor,
        co2eqWtw: dto.co2eqWtw,
        co2Factor: dto.co2Factor,
        gwpCo2: dto.gwpCo2,
        gwpCh4: dto.gwpCh4,
        gwpN2o: dto.gwpN2o,
        slipFactor: dto.slipFactor,
        defaultPrice: dto.defaultPrice,
      })
      return this.systemRepo.save(entity)
    }
    const entity = this.tenantRepo.create({
      organizationId,
      name: dto.name,
      code: dto.code,
      lcv: dto.lcv,
      wellToTankFactor: dto.wellToTankFactor,
      tankToWakeFactor: dto.tankToWakeFactor,
      co2eqWtw: dto.co2eqWtw,
      co2Factor: dto.co2Factor,
      gwpCo2: dto.gwpCo2,
      gwpCh4: dto.gwpCh4,
      gwpN2o: dto.gwpN2o,
      slipFactor: dto.slipFactor,
      price: dto.defaultPrice,
    })
    return this.tenantRepo.save(entity)
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateSystemFuelTypeDto,
  ): Promise<SystemFuelType | TenantFuelType> {
    const systemEntity = await this.systemRepo.findOne({ where: { id } })
    if (systemEntity) {
      const { scope: _scope, ...rest } = dto as any
      Object.assign(systemEntity, rest)
      return this.systemRepo.save(systemEntity)
    }
    const tenantEntity = await this.tenantRepo.findOne({
      where: { id, organizationId },
    })
    if (!tenantEntity) {
      throw new NotFoundException(`Fuel type ${id} not found`)
    }
    const { scope: _scope, defaultPrice, ...rest } = dto as any
    Object.assign(tenantEntity, rest)
    if (defaultPrice !== undefined) {
      tenantEntity.price = defaultPrice
    }
    return this.tenantRepo.save(tenantEntity)
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const tenantResult = await this.tenantRepo.delete({ id, organizationId })
    if (tenantResult.affected && tenantResult.affected > 0) {
      return
    }
    const systemResult = await this.systemRepo.delete({ id })
    if (systemResult.affected === 0) {
      throw new NotFoundException(`Fuel type ${id} not found`)
    }
  }
}
