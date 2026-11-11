import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Repository } from 'typeorm'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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

export interface UpdateRelationshipDto {
  targetModuleId?: string
  relationshipType?: RelationshipType
  description?: string
  configuration?: Record<string, any>
}

export interface UpdateConfigurationDto {
  configType?: string
  schema?: Record<string, any> | null
  documentation?: string | null
  metadata?: Record<string, any> | null
}

export interface ModuleHealthCheck {
  name: string
  status: 'pass' | 'warn' | 'error'
  detail: string
}

export interface ModuleHealth {
  moduleId: string
  status: HealthStatus
  checks: ModuleHealthCheck[]
  statistics: ModuleStatistics[]
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
    @Optional() private readonly dataSource?: DataSource,
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
    /** package = AI 产出的真实包；minimal = 旧模块的最小骨架。 */
    source: 'package' | 'minimal'
    /** 舍弃的实体候选及原因（不静默丢弃）。 */
    dropped: Array<{ name: string; reason: string }>
  }> {
    // 只用窄查询取需要的东西（模块行 + capabilities），不用 `findOne()` 的 8 个关系：
    // 导出一份骨架不需要 aiModel / createdBy / statistics / configurations，
    // 多 JOIN 一次就是多一份故障面与开销。
    //
    // 这条窄查询曾经是**必要的绕过**：`findOne()` 会 JOIN `createdBy`，而早期库的 `users`
    // 表缺 `User` 实体声明的 `role` / `department` / `permissions` 列，查询直接报
    // `column ... role does not exist`。该缺口已由 `1790600000000-AddUsersBaseline` 补上
    // （空库建表 / 旧库补列），既有接口的回归见 `test/blueprint-pipeline.e2e-spec.ts`。
    // 缺口修完后仍保留窄查询：这是**选择**，不再是绕过。
    // 导出这条路径不该被它拖住 —— 但也不该假装它不存在，故在此写明。
    const module = await this.moduleRegistryRepository.findOne({
      where: { id: moduleId, organizationId },
      relations: ['capabilities'],
    })
    if (!module) {
      throw new NotFoundException(`Module with ID ${moduleId} not found`)
    }

    // AI 定义产出的真实包优先：它保留了字段/状态机/规则；不要再生成丢字段的骨架。
    const recordedPackageId = module.metadata?.blueprint?.packageId
    if (typeof recordedPackageId === 'string' && recordedPackageId.length > 0) {
      const packagePath = join(this.blueprints.packagesDirectory(), `${recordedPackageId}.erpkg`)
      if (existsSync(packagePath)) {
        return {
          dir: packagePath,
          packagePath,
          manifest: this.blueprints.manifestOf(recordedPackageId),
          source: 'package',
          dropped: [],
        }
      }
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
    return { dir, packagePath: packaged.packagePath, manifest: packaged.manifest, source: 'minimal', dropped }
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

  async addRelationship(
    moduleId: string,
    dto: CreateRelationshipDto,
    organizationId: string,
  ): Promise<ModuleRelationship> {
    const sourceModule = await this.findOne(moduleId, organizationId)
    if (!dto.targetModuleId) {
      throw new BadRequestException('targetModuleId is required')
    }
    if (dto.targetModuleId === moduleId) {
      throw new BadRequestException('模块不能与自身建立关系')
    }
    const targetModule = await this.findOne(dto.targetModuleId, organizationId)
    this.assertRelationshipType(dto.relationshipType)
    await this.assertNoDuplicateRelationship(
      sourceModule.id,
      targetModule.id,
      dto.relationshipType,
    )
    await this.assertNoDependencyCycle(
      sourceModule.id,
      targetModule.id,
      dto.relationshipType,
      organizationId,
    )

    const relationship = this.relationshipRepository.create({
      sourceModuleId: sourceModule.id,
      targetModuleId: targetModule.id,
      relationshipType: dto.relationshipType,
      description: dto.description,
      configuration: dto.configuration || {},
    })

    return this.relationshipRepository.save(relationship)
  }

  async updateRelationship(
    moduleId: string,
    relationshipId: string,
    dto: UpdateRelationshipDto,
    organizationId: string,
  ): Promise<ModuleRelationship> {
    await this.findOne(moduleId, organizationId)
    const relationship = await this.findRelationship(moduleId, relationshipId)
    const nextType = dto.relationshipType ?? relationship.relationshipType
    this.assertRelationshipType(nextType)

    const nextTargetId = dto.targetModuleId ?? relationship.targetModuleId
    if (nextTargetId === moduleId) {
      throw new BadRequestException('模块不能与自身建立关系')
    }
    await this.findOne(nextTargetId, organizationId)
    if (
      nextTargetId !== relationship.targetModuleId ||
      nextType !== relationship.relationshipType
    ) {
      await this.assertNoDuplicateRelationship(
        moduleId,
        nextTargetId,
        nextType,
        relationship.id,
      )
      await this.assertNoDependencyCycle(
        moduleId,
        nextTargetId,
        nextType,
        organizationId,
        relationship.id,
      )
    }

    relationship.targetModuleId = nextTargetId
    relationship.relationshipType = nextType
    if (dto.description !== undefined) relationship.description = dto.description
    if (dto.configuration !== undefined) relationship.configuration = dto.configuration
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

  /** 关系可视化数据：节点 + 有向边 + 类型计数。 */
  async getRelationshipGraph(organizationId: string): Promise<{
    nodes: Array<{
      id: string
      name: string
      moduleType: ModuleType
      status: ModuleStatus
      version: string
    }>
    edges: Array<{
      id: string
      source: string
      target: string
      type: RelationshipType
      description: string | null
    }>
    summary: {
      modules: number
      edges: number
      dependencies: number
      integrations: number
      dataFlows: number
    }
  }> {
    const modules = await this.findAll(organizationId)
    const ids = modules.map((module) => module.id)
    const relationships =
      ids.length === 0
        ? []
        : await this.relationshipRepository.find({
            where: { sourceModuleId: In(ids) },
          })
    const idSet = new Set(ids)
    const edges = relationships
      .filter((relationship) => idSet.has(relationship.targetModuleId))
      .map((relationship) => ({
        id: relationship.id,
        source: relationship.sourceModuleId,
        target: relationship.targetModuleId,
        type: relationship.relationshipType,
        description: relationship.description ?? null,
      }))
    return {
      nodes: modules.map((module) => ({
        id: module.id,
        name: module.name,
        moduleType: module.moduleType,
        status: module.status,
        version: module.version,
      })),
      edges,
      summary: {
        modules: modules.length,
        edges: edges.length,
        dependencies: edges.filter((edge) => edge.type === RelationshipType.DEPENDENCY)
          .length,
        integrations: edges.filter((edge) => edge.type === RelationshipType.INTEGRATION)
          .length,
        dataFlows: edges.filter((edge) => edge.type === RelationshipType.DATA_FLOW).length,
      },
    }
  }

  async removeRelationship(
    moduleId: string,
    relationshipId: string,
    organizationId?: string,
  ): Promise<void> {
    if (organizationId) await this.findOne(moduleId, organizationId)
    const relationship = await this.findRelationship(moduleId, relationshipId)
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

  private assertRelationshipType(type: RelationshipType): void {
    if (!Object.values(RelationshipType).includes(type)) {
      throw new BadRequestException(
        `relationshipType 必须是 ${Object.values(RelationshipType).join(' / ')}`,
      )
    }
  }

  private async findRelationship(
    moduleId: string,
    relationshipId: string,
  ): Promise<ModuleRelationship> {
    const relationship = await this.relationshipRepository.findOne({
      where: { id: relationshipId },
    })
    if (!relationship) {
      throw new NotFoundException(`Relationship with ID ${relationshipId} not found`)
    }
    if (
      relationship.sourceModuleId !== moduleId &&
      relationship.targetModuleId !== moduleId
    ) {
      throw new BadRequestException('Relationship does not belong to this module')
    }
    return relationship
  }

  private async assertNoDuplicateRelationship(
    sourceModuleId: string,
    targetModuleId: string,
    relationshipType: RelationshipType,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.relationshipRepository.findOne({
      where: { sourceModuleId, targetModuleId, relationshipType },
    })
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('相同源/目标/类型的关系已存在')
    }
  }

  /**
   * 依赖关系必须在加入前检测环：source → target 时，若 target 已能走到 source，
   * 加入后即形成环。返回具体路径，便于调用方修复。
   */
  private async assertNoDependencyCycle(
    sourceModuleId: string,
    targetModuleId: string,
    relationshipType: RelationshipType,
    organizationId: string,
    excludeRelationshipId?: string,
  ): Promise<void> {
    if (relationshipType !== RelationshipType.DEPENDENCY) return
    const path = await this.findDependencyPath(
      targetModuleId,
      sourceModuleId,
      organizationId,
      new Set(),
      excludeRelationshipId,
    )
    if (path) {
      throw new BadRequestException(
        `检测到循环依赖：${[sourceModuleId, ...path].join(' → ')}`,
      )
    }
  }

  private async findDependencyPath(
    fromModuleId: string,
    targetModuleId: string,
    organizationId: string,
    visited: Set<string>,
    excludeRelationshipId?: string,
  ): Promise<string[] | null> {
    if (fromModuleId === targetModuleId) return [targetModuleId]
    if (visited.has(fromModuleId)) return null
    visited.add(fromModuleId)
    const relationships = await this.relationshipRepository.find({
      where: {
        sourceModuleId: fromModuleId,
        relationshipType: RelationshipType.DEPENDENCY,
      },
    })
    const organizationModules = new Set(
      (await this.findAll(organizationId)).map((module) => module.id),
    )
    for (const relationship of relationships) {
      if (relationship.id === excludeRelationshipId) continue
      if (!organizationModules.has(relationship.targetModuleId)) continue
      const path = await this.findDependencyPath(
        relationship.targetModuleId,
        targetModuleId,
        organizationId,
        visited,
        excludeRelationshipId,
      )
      if (path) return [relationship.targetModuleId, ...path]
    }
    return null
  }

  /** 兼容旧私有方法名：返回是否存在环。 */
  private async checkCircularDependency(
    sourceId: string,
    targetId: string,
    visited: Set<string> = new Set(),
  ): Promise<boolean> {
    if (sourceId === targetId) return true
    if (visited.has(sourceId)) return false
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

  /** 状态跟踪：active / inactive / deprecated / error。 */
  async setStatus(
    moduleId: string,
    status: ModuleStatus,
    organizationId: string,
  ): Promise<ModuleRegistry> {
    if (!Object.values(ModuleStatus).includes(status)) {
      throw new BadRequestException(
        `status 必须是 ${Object.values(ModuleStatus).join(' / ')}`,
      )
    }
    const module = await this.findOne(moduleId, organizationId)
    module.status = status
    return this.moduleRegistryRepository.save(module)
  }

  /**
   * 从真实表收集统计：实体候选名 → information_schema 实际表 → COUNT(*)。
   * 找不到表时记 warning，不伪造 0 行为 healthy。
   */
  async collectStatistics(
    moduleId: string,
    organizationId: string,
  ): Promise<ModuleStatistics[]> {
    const module = await this.findOne(moduleId, organizationId)
    const entities = [
      ...new Set(
        [
          ...(module.metadata?.entities ?? []),
          ...(module.capabilities ?? []).map((capability) => capability.entity),
        ].filter((entity): entity is string => Boolean(entity)),
      ),
    ]
    if (entities.length === 0) entities.push('(module)')
    const results: ModuleStatistics[] = []
    for (const entity of entities) {
      const started = Date.now()
      const table = await this.resolveTableName(entity)
      let recordCount = 0
      let lastUpdate: Date | null = null
      let errorCount = 0
      let healthStatus = HealthStatus.HEALTHY
      if (entity === '(module)') {
        healthStatus = HealthStatus.WARNING
      } else if (!table) {
        healthStatus = HealthStatus.WARNING
      } else {
        try {
          const rows: Array<{ count: string | number }> = await this.dataSource!.query(
            `SELECT COUNT(*)::bigint AS count FROM "${table}"`,
          )
          recordCount = Number(rows[0]?.count ?? 0)
          lastUpdate = new Date()
        } catch {
          errorCount = 1
          healthStatus = HealthStatus.ERROR
        }
      }
      const statistics = await this.updateStatistics(moduleId, entity, {
        recordCount,
        lastUpdate: lastUpdate ?? undefined,
        errorCount,
        averageResponseTime: Date.now() - started,
        healthStatus,
        collectedAt: new Date(),
      })
      results.push(statistics)
    }
    return results
  }

  private async resolveTableName(entity: string): Promise<string | null> {
    if (!this.dataSource) return null
    const normalized = entity
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
    const candidates = [
      normalized,
      `${normalized}s`,
      entity.toLowerCase(),
      entity,
    ].filter(Boolean)
    const rows: Array<{ table_name: string }> = await this.dataSource.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND lower(table_name) = ANY($1::text[])
        LIMIT 1`,
      [candidates.map((candidate) => candidate.toLowerCase())],
    )
    return rows[0]?.table_name ?? null
  }

  /** 单模块健康检查：状态、统计、能力、关系四类证据。 */
  async getHealth(moduleId: string, organizationId: string): Promise<ModuleHealth> {
    const module = await this.findOne(moduleId, organizationId)
    const statistics = await this.getStatistics(moduleId)
    const checks: ModuleHealthCheck[] = [
      {
        name: 'module.status',
        status:
          module.status === ModuleStatus.ERROR
            ? 'error'
            : module.status === ModuleStatus.ACTIVE
              ? 'pass'
              : 'warn',
        detail: `模块状态 ${module.status}`,
      },
      {
        name: 'module.capabilities',
        status: (module.capabilities ?? []).length > 0 ? 'pass' : 'warn',
        detail: `${(module.capabilities ?? []).length} 个能力`,
      },
      {
        name: 'module.error-rate',
        status: (() => {
          const records = statistics.reduce((sum, row) => sum + row.recordCount, 0)
          const errors = statistics.reduce((sum, row) => sum + row.errorCount, 0)
          const rate = records > 0 ? errors / records : errors > 0 ? 1 : 0
          return rate >= 0.1 ? 'error' : rate > 0 ? 'warn' : 'pass'
        })(),
        detail: (() => {
          const records = statistics.reduce((sum, row) => sum + row.recordCount, 0)
          const errors = statistics.reduce((sum, row) => sum + row.errorCount, 0)
          const rate = records > 0 ? (errors / records) * 100 : errors > 0 ? 100 : 0
          return `错误率 ${rate.toFixed(2)}%（${errors}/${records || errors}）`
        })(),
      },
      {
        name: 'module.statistics',
        status:
          statistics.length === 0
            ? 'warn'
            : statistics.some((row) => row.healthStatus === HealthStatus.ERROR)
              ? 'error'
              : statistics.some((row) => row.healthStatus === HealthStatus.WARNING)
                ? 'warn'
                : 'pass',
        detail:
          statistics.length === 0
            ? '尚未收集统计'
            : statistics
                .map((row) => `${row.entity ?? '-'}:${row.healthStatus}`)
                .join(', '),
      },
    ]
    const status = checks.some((check) => check.status === 'error')
      ? HealthStatus.ERROR
      : checks.some((check) => check.status === 'warn')
        ? HealthStatus.WARNING
        : HealthStatus.HEALTHY
    return { moduleId, status, checks, statistics }
  }

  async getHealthOverview(organizationId: string) {
    const modules = await this.findAll(organizationId)
    const results = await Promise.all(
      modules.map(async (module) => {
        const health = await this.getHealth(module.id, organizationId)
        return { id: module.id, name: module.name, status: health.status }
      }),
    )
    return {
      total: results.length,
      healthy: results.filter((row) => row.status === HealthStatus.HEALTHY).length,
      warning: results.filter((row) => row.status === HealthStatus.WARNING).length,
      error: results.filter((row) => row.status === HealthStatus.ERROR).length,
      modules: results,
    }
  }

  async updateConfiguration(
    moduleId: string,
    configurationId: string,
    dto: UpdateConfigurationDto,
    organizationId: string,
  ): Promise<ModuleConfiguration> {
    await this.findOne(moduleId, organizationId)
    const configuration = await this.configurationRepository.findOne({
      where: { id: configurationId, moduleId },
    })
    if (!configuration) throw new NotFoundException('Configuration not found')
    if (dto.configType !== undefined) configuration.configType = dto.configType
    if (dto.schema !== undefined) configuration.schema = dto.schema as never
    if (dto.documentation !== undefined) {
      configuration.documentation = dto.documentation as never
    }
    if (dto.metadata !== undefined) configuration.metadata = dto.metadata as never
    return this.configurationRepository.save(configuration)
  }

  async deleteConfiguration(
    moduleId: string,
    configurationId: string,
    organizationId: string,
  ): Promise<void> {
    await this.findOne(moduleId, organizationId)
    const configuration = await this.configurationRepository.findOne({
      where: { id: configurationId, moduleId },
    })
    if (!configuration) throw new NotFoundException('Configuration not found')
    await this.configurationRepository.remove(configuration)
  }

  /** 从能力/关系/配置生成 Markdown 文档（API + 关系 + 使用说明）。 */
  async generateDocumentation(
    moduleId: string,
    organizationId: string,
  ): Promise<{ moduleId: string; markdown: string; generatedAt: string }> {
    const module = await this.findOne(moduleId, organizationId)
    const capabilities = module.capabilities ?? []
    const relationships = await this.getRelationships(moduleId)
    const configurations = module.configurations ?? []
    const lines: string[] = [
      `# ${module.name}`,
      '',
      `- 版本：${module.version}`,
      `- 类型：${module.moduleType}`,
      `- 状态：${module.status}`,
      `- 实体：${(module.metadata?.entities ?? []).join(', ') || '-'}`,
      '',
      '## Capabilities',
      '',
      '| Entity | Type | Operations | API |',
      '|---|---|---|---|',
      ...capabilities.map(
        (capability) =>
          `| ${capability.entity ?? '-'} | ${capability.capabilityType} | ${(capability.operations ?? []).join(', ')} | ${(capability.apiEndpoints ?? []).join('<br>') || '-'} |`,
      ),
      '',
      '## API',
      '',
      ...capabilities.flatMap((capability) =>
        (capability.apiEndpoints ?? []).map(
          (endpoint) =>
            `- \`${endpoint}\`（${capability.entity ?? '-'}：${(capability.operations ?? []).join(', ')}）`,
        ),
      ),
      '',
      '## Relationships',
      '',
      ...relationships.map((relationship) => {
        const direction =
          relationship.sourceModuleId === moduleId
            ? `→ ${relationship.targetModuleId}`
            : `← ${relationship.sourceModuleId}`
        return `- ${relationship.relationshipType} ${direction}${relationship.description ? `：${relationship.description}` : ''}`
      }),
      '',
      '## Configuration',
      '',
      ...configurations.map(
        (configuration) =>
          `### ${configuration.configType}

${configuration.documentation ?? ''}`,
      ),
    ]
    return {
      moduleId,
      markdown: lines.join('\n'),
      generatedAt: new Date().toISOString(),
    }
  }

  /** 给 AI 生成用的紧凑上下文：模块、能力、实体、端点。 */
  async getAiGenerationContext(organizationId: string) {
    const modules = await this.moduleRegistryRepository.find({
      where: { organizationId },
      relations: ['capabilities'],
      order: { createdAt: 'DESC' },
      take: 20,
    })
    return modules.map((module) => ({
      id: module.id,
      name: module.name,
      moduleType: module.moduleType,
      status: module.status,
      version: module.version,
      entities: module.metadata?.entities ?? [],
      capabilities: (module.capabilities ?? []).map((capability) => ({
        entity: capability.entity,
        operations: capability.operations,
        apiEndpoints: capability.apiEndpoints,
      })),
    }))
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
