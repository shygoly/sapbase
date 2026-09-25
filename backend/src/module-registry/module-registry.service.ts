import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ModuleRegistry, ModuleStatus, ModuleType } from './module-registry.entity'
import { ModuleRelationship, RelationshipType } from './module-relationship.entity'
import { ModuleCapability, CapabilityType } from './module-capability.entity'
import { ModuleStatistics, HealthStatus } from './module-statistics.entity'
import { ModuleConfiguration } from './module-configuration.entity'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { BlueprintService } from '../blueprint/blueprint.service'
import { BLUEPRINT_META_FILE } from '../blueprint/packager'
import type { BlueprintManifest } from '@speckit/shared-schemas'
import {
  buildMinimalBlueprint,
  collectEntityNames,
  parseAtomicDependencies,
} from './blueprint-export'

export interface CreateModuleRegistryDto {
  name: string
  /** 依赖的原子：`atomicType@range`，发布（active）时校验。 */
  dependsOnAtomics?: string[]
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
    private readonly atomicRegistry: AtomicRegistryService,
    private readonly blueprints: BlueprintService,
  ) {}

  /** 导出骨架的落盘根目录（未指定 `dir` 时用）。 */
  private readonly exportRoot =
    process.env.BLUEPRINT_EXPORT_DIR ?? join(tmpdir(), 'speckit-blueprints')

  /**
   * 把库里一条模块记录导出为**最小蓝图**并打成 `.erpkg`。
   *
   * 这是"模块定义 → 蓝图包"那一环：在此之前模块只是数据库里的一行，
   * 无法导出、无法版本化、也无法在别处重建。
   *
   * 导出内容 = 模块**确实拥有**的东西：实体名（capability / `metadata.entities`）
   * 与原子依赖（`dependsOnAtomics`）。原子依赖**逐条解析**，解析不到就拒绝导出
   * —— 与发布时同一判据（元语不变量 4），否则等于交付一个"编译必然失败"的包。
   */
  async exportBlueprint(
    moduleId: string,
    organizationId: string,
    options: { dir?: string; out?: string } = {},
  ): Promise<{
    dir: string
    packagePath: string
    manifest: BlueprintManifest
    /** 舍弃的实体候选及原因（不静默丢弃）。 */
    dropped: Array<{ name: string; reason: string }>
  }> {
    // 只用窄查询取需要的东西（模块行 + capabilities）。
    //
    // 不用 `findOne()` 是因为它会连同 `createdBy` 一起 JOIN `users`，而本地库的 `users`
    // 是早期形态（`roleId` / `departmentId`），`User` 实体声明的 `role` / `department` /
    // `permissions` 在库里不存在，于是那条查询直接报 `column ... role does not exist`。
    // 根因是**仓库迁移集没有 `users` 基线**（没有任何迁移创建该表），属既有缺口，另立变更修。
    // 导出这条路径不该被它拖住 —— 但也不该假装它不存在，故在此写明。
    const module = await this.moduleRegistryRepository.findOne({
      where: { id: moduleId, organizationId },
      relations: ['capabilities'],
    })
    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`)
    }
    const dependsOnAtomics = module.dependsOnAtomics ?? []

    const { names, dropped } = collectEntityNames({
      declared: module.metadata?.entities,
      capabilities: (module.capabilities ?? []).map((capability) => capability.entity),
    })
    const dependencies = parseAtomicDependencies(dependsOnAtomics)
    await this.assertAtomicDependencies(dependsOnAtomics)

    const minimal = buildMinimalBlueprint({
      name: module.name,
      version: module.version,
      entityNames: names,
      dependencies,
    })

    const dir =
      options.dir ?? join(this.exportRoot, `${minimal.meta.blueprint}-${minimal.meta.version}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, BLUEPRINT_META_FILE), `${JSON.stringify(minimal.meta, null, 2)}\n`)
    writeFileSync(
      join(dir, 'semantic.json'),
      `${JSON.stringify(minimal.semantic, null, 2)}\n`,
    )

    const packaged = this.blueprints.packageFrom(dir, options.out)
    return { dir, packagePath: packaged.packagePath, manifest: packaged.manifest, dropped }
  }

  /**
   * 发布前校验原子依赖（元语不变量 4：依赖不满足就不许发布）。
   *
   * 每条依赖形如 `available-inventory@^1.0.0`；逐条走 `AtomicRegistry.resolve`，
   * 解析不到（无 active 契约 / 无可执行实现）即拒，并**一次列出全部缺失项**
   * —— 而不是让调用方一条一条试。
   */
  async assertAtomicDependencies(dependsOnAtomics: string[]): Promise<void> {
    if (!dependsOnAtomics || dependsOnAtomics.length === 0) return

    const missing: string[] = []
    for (const dependency of dependsOnAtomics) {
      const at = dependency.lastIndexOf('@')
      if (at <= 0 || at === dependency.length - 1) {
        missing.push(`${dependency}（格式应为 atomicType@range）`)
        continue
      }
      try {
        await this.atomicRegistry.resolve(
          dependency.slice(0, at),
          dependency.slice(at + 1),
        )
      } catch (error) {
        missing.push(`${dependency}（${(error as Error).message}）`)
      }
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `模块依赖的原子不可用，拒绝发布：${missing.join('; ')}`,
      )
    }
  }

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
    const status = dto.status || ModuleStatus.ACTIVE
    const dependsOnAtomics = dto.dependsOnAtomics ?? []
    if (status === ModuleStatus.ACTIVE) {
      await this.assertAtomicDependencies(dependsOnAtomics)
    }

    const module = this.moduleRegistryRepository.create({
      name: dto.name,
      description: dto.description,
      moduleType: dto.moduleType || ModuleType.CRUD,
      aiModelId: dto.aiModelId,
      createdById: dto.createdById,
      version: dto.version || '1.0.0',
      status,
      dependsOnAtomics,
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
