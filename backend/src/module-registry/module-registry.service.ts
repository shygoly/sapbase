import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ModuleRegistry, ModuleStatus, ModuleType } from './module-registry.entity'
import { ModuleRelationship, RelationshipType } from './module-relationship.entity'
import { ModuleCapability, CapabilityType } from './module-capability.entity'
import { ModuleStatistics, HealthStatus } from './module-statistics.entity'
import { ModuleConfiguration } from './module-configuration.entity'

export interface CreateModuleRegistryDto {
  name: string
  description?: string
  moduleType?: ModuleType
  aiModelId?: string
  createdById?: string
  version?: string
  status?: ModuleStatus
  aiModuleId?: string
  metadata?: Record<string, any>
}

export interface CreateCapabilityDto {
  capabilityType: CapabilityType
  entity?: string
  operations: string[]
  apiEndpoints: string[]
  description?: string
}

export interface CreateRelationshipDto {
  targetModuleId: string
  relationshipType: RelationshipType
  description?: string
  configuration?: Record<string, any>
}

@Injectable()
export class ModuleRegistryService {
  constructor(
    @InjectRepository(ModuleRegistry)
    private moduleRegistryRepository: Repository<ModuleRegistry>,
    @InjectRepository(ModuleRelationship)
    private relationshipRepository: Repository<ModuleRelationship>,
    @InjectRepository(ModuleCapability)
    private capabilityRepository: Repository<ModuleCapability>,
    @InjectRepository(ModuleStatistics)
    private statisticsRepository: Repository<ModuleStatistics>,
    @InjectRepository(ModuleConfiguration)
    private configurationRepository: Repository<ModuleConfiguration>,
  ) {}

  async findAll(organizationId: string): Promise<ModuleRegistry[]> {
    return this.moduleRegistryRepository.find({
      where: { organizationId },
      relations: ['aiModel', 'createdBy', 'aiModule'],
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string, organizationId: string): Promise<ModuleRegistry> {
    const module = await this.moduleRegistryRepository.findOne({
      where: { id, organizationId },
      relations: [
        'aiModel',
        'createdBy',
        'aiModule',
        'capabilities',
        'outgoingRelationships',
        'incomingRelationships',
        'statistics',
        'configurations',
      ],
    })

    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`)
    }

    return module
  }

  async create(dto: CreateModuleRegistryDto, organizationId: string): Promise<ModuleRegistry> {
    const module = this.moduleRegistryRepository.create({
      name: dto.name,
      description: dto.description,
      moduleType: dto.moduleType || ModuleType.CRUD,
      aiModelId: dto.aiModelId,
      createdById: dto.createdById,
      version: dto.version || '1.0.0',
      status: dto.status || ModuleStatus.ACTIVE,
      aiModuleId: dto.aiModuleId,
      metadata: dto.metadata || {},
      organizationId,
    })

    return this.moduleRegistryRepository.save(module)
  }

  async update(id: string, dto: Partial<CreateModuleRegistryDto>, organizationId: string): Promise<ModuleRegistry> {
    const module = await this.findOne(id, organizationId)
    Object.assign(module, dto)
    return this.moduleRegistryRepository.save(module)
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const module = await this.findOne(id, organizationId)
    await this.moduleRegistryRepository.remove(module)
  }

  async addCapability(moduleId: string, dto: CreateCapabilityDto, organizationId: string): Promise<ModuleCapability> {
    const module = await this.findOne(moduleId, organizationId)
    const capability = this.capabilityRepository.create({
      moduleId: module.id,
      ...dto,
    })
    return this.capabilityRepository.save(capability)
  }

  async getCapabilities(moduleId: string): Promise<ModuleCapability[]> {
    return this.capabilityRepository.find({
      where: { moduleId },
      order: { createdAt: 'ASC' },
    })
  }

  async addRelationship(moduleId: string, dto: CreateRelationshipDto, organizationId: string): Promise<ModuleRelationship> {
    const sourceModule = await this.findOne(moduleId, organizationId)
    const targetModule = await this.findOne(dto.targetModuleId, organizationId)

    // Check for circular dependency
    if (dto.relationshipType === RelationshipType.DEPENDENCY) {
      const hasCircular = await this.checkCircularDependency(
        dto.targetModuleId,
        moduleId,
      )
      if (hasCircular) {
        throw new Error('Circular dependency detected')
      }
    }

    const relationship = this.relationshipRepository.create({
      sourceModuleId: sourceModule.id,
      targetModuleId: targetModule.id,
      relationshipType: dto.relationshipType,
      description: dto.description,
      configuration: dto.configuration || {},
    })

    return this.relationshipRepository.save(relationship)
  }

  async getRelationships(moduleId: string): Promise<ModuleRelationship[]> {
    const outgoing = await this.relationshipRepository.find({
      where: { sourceModuleId: moduleId },
      relations: ['targetModule'],
    })

    const incoming = await this.relationshipRepository.find({
      where: { targetModuleId: moduleId },
      relations: ['sourceModule'],
    })

    return [...outgoing, ...incoming]
  }

  async removeRelationship(moduleId: string, relationshipId: string): Promise<void> {
    const relationship = await this.relationshipRepository.findOne({
      where: { id: relationshipId },
    })

    if (!relationship) {
      throw new NotFoundException(`Relationship with ID ${relationshipId} not found`)
    }

    if (relationship.sourceModuleId !== moduleId && relationship.targetModuleId !== moduleId) {
      throw new Error('Relationship does not belong to this module')
    }

    await this.relationshipRepository.remove(relationship)
  }

  async updateStatistics(
    moduleId: string,
    entity: string,
    stats: Partial<ModuleStatistics>,
  ): Promise<ModuleStatistics> {
    let statistics = await this.statisticsRepository.findOne({
      where: { moduleId, entity },
    })

    if (!statistics) {
      statistics = this.statisticsRepository.create({
        moduleId,
        entity,
        ...stats,
      })
    } else {
      Object.assign(statistics, stats)
    }

    return this.statisticsRepository.save(statistics)
  }

  async getStatistics(moduleId: string): Promise<ModuleStatistics[]> {
    return this.statisticsRepository.find({
      where: { moduleId },
      order: { collectedAt: 'DESC' },
    })
  }

  async addConfiguration(
    moduleId: string,
    configType: string,
    schema?: Record<string, any>,
    documentation?: string,
  ): Promise<ModuleConfiguration> {
    const config = this.configurationRepository.create({
      moduleId,
      configType,
      schema,
      documentation,
    })
    return this.configurationRepository.save(config)
  }

  async getConfigurations(moduleId: string): Promise<ModuleConfiguration[]> {
    return this.configurationRepository.find({
      where: { moduleId },
      order: { createdAt: 'ASC' },
    })
  }

  private async checkCircularDependency(
    sourceId: string,
    targetId: string,
    visited: Set<string> = new Set(),
  ): Promise<boolean> {
    if (sourceId === targetId) {
      return true
    }

    if (visited.has(sourceId)) {
      return false
    }

    visited.add(sourceId)

    const relationships = await this.relationshipRepository.find({
      where: {
        sourceModuleId: sourceId,
        relationshipType: RelationshipType.DEPENDENCY,
      },
    })

    for (const rel of relationships) {
      if (await this.checkCircularDependency(rel.targetModuleId, targetId, visited)) {
        return true
      }
    }

    return false
  }

  async findByAiModuleId(aiModuleId: string, organizationId?: string): Promise<ModuleRegistry | null> {
    const where: any = { aiModuleId }
    if (organizationId) {
      where.organizationId = organizationId
    }
    return this.moduleRegistryRepository.findOne({
      where,
      relations: ['capabilities', 'statistics'],
    })
  }
}
