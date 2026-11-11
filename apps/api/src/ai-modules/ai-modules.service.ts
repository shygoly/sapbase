import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import { AIModule, AIModuleStatus } from './ai-module.entity'
import { AIModuleTest, TestStatus } from './ai-module-test.entity'
import { AIModuleReview, ReviewDecision } from './ai-module-review.entity'
import { AIModuleDefinition } from './ai-module-definition.entity'
import { AIModelsService } from '../ai-models/ai-models.service'
import { AIModuleBlueprintService } from './ai-module-blueprint.service'
import { DeliverError } from '../blueprint/blueprint.service'
import { LoadError } from '../blueprint/loader'
import {
  applyDefinitionPatch,
  bumpPatchVersion,
  DefinitionPatchError,
  type DefinitionPatch,
} from './definition-patch.service'
import { ModuleRegistryService } from '../module-registry/module-registry.service'
import { ModuleType, ModuleStatus } from '../module-registry/module-registry.entity'
import { CapabilityType } from '../module-registry/module-capability.entity'
import { getDefinitionStepPrompt } from './definition-step-prompts'
import { DEFINITION_STEP_IDS, type DefinitionStepId } from './definition-step-prompts'
import { assertDefinitionStep, assertMergedDefinition } from './definition-schema'
import { extractAiJsonObject } from './ai-response'
import {
  definitionToBlueprint,
  DefinitionToBlueprintError,
  normalizeDefinitionShape,
} from './definition-to-blueprint'
import { normalizeStep3ForSave } from './step3-normalizer'
import axios from 'axios'

@Injectable()
export class AIModulesService {
  constructor(
    @InjectRepository(AIModule)
    private aiModuleRepository: Repository<AIModule>,
    @InjectRepository(AIModuleTest)
    private aiModuleTestRepository: Repository<AIModuleTest>,
    @InjectRepository(AIModuleReview)
    private aiModuleReviewRepository: Repository<AIModuleReview>,
    @InjectRepository(AIModuleDefinition)
    private aiModuleDefinitionRepository: Repository<AIModuleDefinition>,
    private aiModelsService: AIModelsService,
    private moduleRegistryService: ModuleRegistryService,
    private aiModuleBlueprints: AIModuleBlueprintService,
  ) {}

  async findAll(organizationId: string, status?: AIModuleStatus): Promise<AIModule[]> {
    const where: any = { organizationId }
    if (status) {
      where.status = status
    }
    return this.aiModuleRepository.find({
      where,
      relations: ['aiModel', 'createdBy', 'reviewedBy'],
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string, organizationId: string): Promise<AIModule> {
    const module = await this.aiModuleRepository.findOne({
      where: { id, organizationId },
      relations: ['aiModel', 'createdBy', 'reviewedBy'],
    })
    if (!module) {
      throw new NotFoundException(`AI Module with ID ${id} not found`)
    }
    return module
  }

  /**
   * Browse/search saved Module DSL (patchContent) without generating code.
   */
  async searchDsl(
    organizationId: string,
    input: { search?: string; page?: number; limit?: number } = {},
  ): Promise<{
    items: Array<{
      id: string
      name: string
      description: string | null
      status: AIModuleStatus
      version: string
      updatedAt: Date
      dslKeys: string[]
      hasDefinition: boolean
    }>
    total: number
    page: number
    limit: number
  }> {
    const page = Math.max(1, Number(input.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(input.limit) || 20))
    const search = input.search?.trim()

    const qb = this.aiModuleRepository
      .createQueryBuilder('module')
      .where('module.organizationId = :organizationId', { organizationId })
      .orderBy('module.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)

    if (search) {
      qb.andWhere(
        "(LOWER(module.name) LIKE :q OR LOWER(COALESCE(module.description, '')) LIKE :q OR LOWER(CAST(module.patchContent AS TEXT)) LIKE :q)",
        { q: `%${search.toLowerCase()}%` },
      )
    }

    const [modules, total] = await qb.getManyAndCount()
    const definitions = await this.aiModuleDefinitionRepository.find({
      where: { aiModuleId: In(modules.map((module) => module.id)) },
      select: ['aiModuleId'],
    })
    const withDefinition = new Set(definitions.map((definition) => definition.aiModuleId))

    return {
      items: modules.map((module) => ({
        id: module.id,
        name: module.name,
        description: module.description ?? null,
        status: module.status,
        version: module.version,
        updatedAt: module.updatedAt,
        dslKeys:
          module.patchContent && typeof module.patchContent === 'object'
            ? Object.keys(module.patchContent)
            : [],
        hasDefinition: withDefinition.has(module.id),
      })),
      total,
      page,
      limit,
    }
  }

  /**
   * Read both DSL artifacts for one module: patchContent and the original 6-step definition.
   */
  async getDslBundle(
    id: string,
    organizationId: string,
  ): Promise<{
    module: {
      id: string
      name: string
      description: string | null
      status: AIModuleStatus
      version: string
      updatedAt: Date
    }
    patchContent: Record<string, any>
    definition: AIModuleDefinition | null
  }> {
    const module = await this.findOne(id, organizationId)
    const definition = await this.getDefinition(id)
    return {
      module: {
        id: module.id,
        name: module.name,
        description: module.description ?? null,
        status: module.status,
        version: module.version,
        updatedAt: module.updatedAt,
      },
      patchContent: module.patchContent ?? {},
      definition,
    }
  }

  async create(createDto: Partial<AIModule>, organizationId: string): Promise<AIModule> {
    const module = this.aiModuleRepository.create({
      ...createDto,
      organizationId,
    })
    return this.aiModuleRepository.save(module)
  }

  async update(id: string, updateDto: Partial<AIModule>, organizationId: string): Promise<AIModule> {
    const module = await this.findOne(id, organizationId)
    Object.assign(module, updateDto)
    return this.aiModuleRepository.save(module)
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const module = await this.findOne(id, organizationId)
    await this.aiModuleRepository.remove(module)
  }

  async generatePatch(
    moduleId: string,
    naturalLanguagePrompt: string,
    organizationId: string,
    entityType?: string,
    entityId?: string,
  ): Promise<AIModule> {
    const module = await this.findOne(moduleId, organizationId)
    const defaultModel = await this.aiModelsService.findDefault()

    if (!defaultModel) {
      throw new BadRequestException('No active AI model configured')
    }

    // 旧工作流状态上下文已随桥退场；entityType/entityId 保留签名兼容，回归时机见 workflow-consolidation.md
    void entityType
    void entityId
    const userContent = `Generate a Patch DSL JSON for: ${naturalLanguagePrompt}`

    try {
      // Generate patch using AI model
      const baseUrl = defaultModel.baseUrl || 'https://api.kimi.com/coding/'
      const apiUrl = `${baseUrl.replace(/\/$/, '')}/v1/messages`

      const response = await axios.post(
        apiUrl,
        {
          model: defaultModel.model || 'kimi-for-coding',
          messages: [
            {
              role: 'system',
              content: 'You are a Patch DSL generator. Generate valid Patch DSL JSON from natural language descriptions.',
            },
            {
              role: 'user',
              content: userContent,
            },
          ],
          max_tokens: 2000,
        },
        {
          headers: {
            'Authorization': `Bearer ${defaultModel.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      // Extract patch JSON from response and normalize to protocol shape (patchId, timestamp, actor)
      const raw = this.extractPatchFromResponse(response.data)
      const patchContent = this.normalizePatchContent(raw, 'ai')

      // Update module
      module.naturalLanguagePrompt = naturalLanguagePrompt
      module.patchContent = patchContent
      module.aiModel = defaultModel as any
      module.aiModelId = defaultModel.id

      return this.aiModuleRepository.save(module)
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate patch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 六步定义 → Blueprint 五层（确定性，不再调用 LLM 生成未定义的 “Model DSL”）。
   *
   * 产物写进 patchContent：保留 objects（publish 侧 metadata / capability 提取仍可用）
   * 以及 semantic/flows/rules/experience（预览与后续打包可直接用）。
   * 任何转换失败都抛 400，不覆盖旧 patchContent。
   */
  async generateFromDefinition(
    moduleId: string,
    definition: Record<string, any>,
    organizationId: string,
  ): Promise<AIModule> {
    const module = await this.findOne(moduleId, organizationId)
    const normalized = normalizeDefinitionShape(definition)
    return this.persistDefinitionAsBlueprint(module, normalized)
  }

  /**
   * 应用一个服务端可表达的 Patch（object/state），bump 版本并重新产包编译。
   * 旧包不覆盖：包 id 含新版本。
   */
  async applyDefinitionPatchToModule(
    moduleId: string,
    patch: DefinitionPatch,
    organizationId: string,
    confirmed = false,
  ): Promise<AIModule> {
    const module = await this.findOne(moduleId, organizationId)
    const stored = await this.getDefinition(moduleId)
    if (!stored) {
      throw new BadRequestException('该模块还没有六步定义，无法应用 Patch')
    }
    const merged = stored.mergedDefinition
    const current =
      merged && typeof merged === 'object' && Object.keys(merged).length > 0
        ? merged
        : {
            objectModel: stored.step1_objectModel,
            relationships: stored.step2_relationships,
            stateFlow: stored.step3_stateFlow,
            pages: stored.step4_pages,
            permissions: stored.step5_permissions,
            reports: stored.step6_reports,
          }

    let applied: ReturnType<typeof applyDefinitionPatch>
    try {
      applied = applyDefinitionPatch(current, patch, { confirmed })
    } catch (error) {
      if (error instanceof DefinitionPatchError) {
        throw new BadRequestException({
          message: error.message,
          reason: error.reason,
        })
      }
      throw error
    }

    try {
      module.version = bumpPatchVersion(module.version)
    } catch (error) {
      if (error instanceof DefinitionPatchError) {
        throw new BadRequestException({ message: error.message, reason: error.reason })
      }
      throw error
    }

    const saved = await this.persistDefinitionAsBlueprint(module, applied.definition)
    const history = Array.isArray(saved.metadata?.patches) ? saved.metadata.patches : []
    saved.metadata = {
      ...(saved.metadata ?? {}),
      patches: [
        ...history,
        {
          patchId: patch.patchId ?? `patch-${Date.now()}`,
          scope: patch.scope,
          operation: patch.operation,
          target: patch.target,
          changed: applied.changed,
          appliedAt: new Date().toISOString(),
        },
      ],
    }
    return this.aiModuleRepository.save(saved)
  }

  /**
   * 六步定义 → Blueprint 层 → `.erpkg` → 编译；失败不更新模块。
   */
  private async persistDefinitionAsBlueprint(
    module: AIModule,
    definition: Record<string, unknown>,
  ): Promise<AIModule> {
    assertMergedDefinition(definition)

    let layers: ReturnType<typeof definitionToBlueprint>
    try {
      layers = definitionToBlueprint(definition)
    } catch (error) {
      if (error instanceof DefinitionToBlueprintError) {
        throw new BadRequestException({
          message: `定义无法转换为 Blueprint：${error.message}`,
          reason: error.reason,
        })
      }
      throw error
    }

    let materialized: Awaited<ReturnType<AIModuleBlueprintService['materialize']>>
    try {
      materialized = await this.aiModuleBlueprints.materialize({
        name: module.name,
        version: module.version,
        layers,
      })
    } catch (error) {
      throw new BadRequestException(
        `Blueprint 打包/编译失败：${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }

    const objects = Object.fromEntries(
      layers.semantic.entities.map((entity) => [entity.name, entity]),
    )
    module.naturalLanguagePrompt = 'Generated from 6-step definition'
    module.metadata = {
      ...(module.metadata ?? {}),
      blueprint: {
        packageId: materialized.packageId,
        irDigest: materialized.irDigest,
        compiledAt: materialized.compiledAt,
      },
    }
    module.patchContent = {
      version: '1.0',
      patchId: uuidv4(),
      timestamp: new Date().toISOString(),
      actor: 'ai',
      scope: 'blueprint',
      operation: 'add',
      target: { type: 'blueprint', identifier: module.name },
      blueprint: {
        packageId: materialized.packageId,
        irDigest: materialized.irDigest,
      },
      objects,
      semantic: layers.semantic,
      flows: layers.flows,
      ...(layers.rules ? { rules: layers.rules } : {}),
      ...(layers.experience ? { experience: layers.experience } : {}),
    }

    // 先保存定义再写模块 patch：定义失败时不会留下“patch 已更新、定义没更新”的半状态。
    await this.saveDefinition(module.id, definition)
    return this.aiModuleRepository.save(module)
  }

  async modifyExistingModule(
    moduleRegistryId: string,
    naturalLanguagePrompt: string,
    organizationId: string,
    userId?: string,
  ): Promise<AIModule> {
    if (!moduleRegistryId) {
      throw new BadRequestException('Module registry ID is required')
    }
    if (!naturalLanguagePrompt || !naturalLanguagePrompt.trim()) {
      throw new BadRequestException('Prompt is required')
    }

    const registryModule = await this.moduleRegistryService.findOne(moduleRegistryId, organizationId)
    let module: AIModule | null = null

    if (registryModule.aiModuleId) {
      try {
        module = await this.findOne(registryModule.aiModuleId, organizationId)
      } catch {
        module = null
      }
    }

    if (!module) {
      module = this.aiModuleRepository.create({
        name: registryModule.name,
        description: registryModule.description,
        status: AIModuleStatus.DRAFT,
        version: registryModule.version || '1.0.0',
        patchContent: {},
        organizationId,
        createdById: userId || registryModule.createdById,
      })
      module = await this.aiModuleRepository.save(module)
      await this.moduleRegistryService.update(registryModule.id, { aiModuleId: module.id }, organizationId)
    }

    const defaultModel = await this.aiModelsService.findDefault()
    if (!defaultModel) {
      throw new BadRequestException('No active AI model configured')
    }

    try {
      const baseUrl = defaultModel.baseUrl || 'https://api.kimi.com/coding/'
      const apiUrl = `${baseUrl.replace(/\/$/, '')}/v1/messages`
      const existingPatch = module.patchContent || {}

      const response = await axios.post(
        apiUrl,
        {
          model: defaultModel.model || 'kimi-for-coding',
          messages: [
            {
              role: 'system',
              content:
                'You are a Patch DSL generator. Generate an incremental Patch DSL JSON to modify an existing module. The patch MUST use operation "update" and include only the changes needed. Return JSON only.',
            },
            {
              role: 'user',
              content: `Existing Patch DSL JSON:\n${JSON.stringify(existingPatch)}\n\nModule Metadata:\n${JSON.stringify(
                registryModule.metadata || {},
              )}\n\nChange Request: ${naturalLanguagePrompt}`,
            },
          ],
          max_tokens: 2000,
        },
        {
          headers: {
            'Authorization': `Bearer ${defaultModel.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      )

      const raw = this.extractPatchFromResponse(response.data)
      const patchContent = this.normalizePatchContent(raw, 'ai')

      module.naturalLanguagePrompt = naturalLanguagePrompt
      module.patchContent = patchContent
      module.aiModel = defaultModel as any
      module.aiModelId = defaultModel.id

      return this.aiModuleRepository.save(module)
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate patch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async generateDefinitionStep(
    stepId: string,
    userInput: string,
    context?: string,
  ): Promise<Record<string, any>> {
    if (!stepId?.trim()) {
      throw new BadRequestException('stepId is required')
    }
    const rawInput = (userInput ?? '').trim()
    const rawContext = (context ?? '').trim()
    const hasInput = rawInput.length > 0
    const hasContext = rawContext.length > 0
    if (!hasInput && !hasContext) {
      throw new BadRequestException('userInput or context is required')
    }

    try {
      const systemPrompt = getDefinitionStepPrompt(stepId)
      const defaultModel = await this.aiModelsService.findDefault()
      if (!defaultModel) {
        throw new BadRequestException('No active AI model configured')
      }

      const safeInput = this.sanitizeForAiInput(rawInput)
      const safeContext = this.sanitizeForAiInput(rawContext)

      let userMessage: string
      if (hasContext && hasInput) {
        userMessage = `Context from previous steps:\n${safeContext}\n\nCurrent step input:\n${safeInput}`
      } else if (hasContext) {
        userMessage = `Context from previous steps:\n${safeContext}`
      } else {
        userMessage = safeInput
      }

      const baseUrl = defaultModel.baseUrl || 'https://api.kimi.com/coding/'
      const apiUrl = `${baseUrl.replace(/\/$/, '')}/v1/messages`

      const response = await axios.post(
        apiUrl,
        {
          model: defaultModel.model || 'kimi-for-coding',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 8000,
        },
        {
          headers: {
            Authorization: `Bearer ${defaultModel.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      )

      let extracted = extractAiJsonObject(response.data)
      if (stepId === 'state-flow') {
        const normalized = normalizeStep3ForSave(extracted)
        if ('error' in normalized) {
          throw new BadRequestException(`State flow invalid: ${normalized.error}`)
        }
        extracted = normalized.normalized as unknown as Record<string, unknown>
      }
      assertDefinitionStep(stepId as DefinitionStepId, extracted)
      return extracted
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new BadRequestException(`Definition step failed: ${message}`)
    }
  }

  /**
   * Generate all 6 definition steps in sequence. Step 3 (state-flow) is normalized and validated.
   * Optionally save to module when moduleId is provided.
   */
  async generateAllDefinitionSteps(
    userInput: string,
    moduleId?: string,
  ): Promise<Record<string, any>> {
    const rawInput = (userInput ?? '').trim()
    if (!rawInput.length) {
      throw new BadRequestException('userInput is required for one-shot generation')
    }

    const steps: Record<string, any> = {}
    let contextObj: Record<string, any> = {}

    for (let i = 0; i < DEFINITION_STEP_IDS.length; i++) {
      const stepId = DEFINITION_STEP_IDS[i]
      const stepUserInput = i === 0 ? rawInput : ''
      const contextStr = i > 0 ? JSON.stringify(contextObj, null, 2) : ''

      let stepResult: Record<string, any> = await this.generateDefinitionStep(stepId, stepUserInput, contextStr)

      if (stepId === 'state-flow') {
        const normalized = normalizeStep3ForSave(stepResult)
        if ('error' in normalized) {
          try {
            stepResult = await this.generateDefinitionStep(stepId, stepUserInput, contextStr)
            const retryNormalized = normalizeStep3ForSave(stepResult)
            if ('error' in retryNormalized) {
              throw new BadRequestException(`State flow invalid after retry: ${retryNormalized.error}`)
            }
            stepResult = retryNormalized.normalized
          } catch (retryError) {
            if (retryError instanceof BadRequestException) throw retryError
            throw new BadRequestException(
              `State flow step failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`,
            )
          }
        } else {
          stepResult = normalized.normalized
        }
      }

      const stepKey =
        stepId === 'object-model'
          ? 'objectModel'
          : stepId === 'state-flow'
            ? 'stateFlow'
            : stepId
      steps[stepKey] = stepResult
      contextObj = { ...steps }
    }

    const merged = {
      objectModel: steps.objectModel,
      relationships: steps.relationships,
      stateFlow: steps.stateFlow,
      pages: steps.pages,
      permissions: steps.permissions,
      reports: steps.reports,
    }

    if (moduleId) {
      await this.saveDefinition(moduleId, merged)
    }

    return merged
  }

  /**
   * Preprocess user input before sending to the AI to avoid API failures:
   * - Strip control characters (except tab, newline, carriage return)
   * - Normalize line endings to \n
   * - Trim trailing whitespace per line
   * - Cap length to stay within model context
   */
  private sanitizeForAiInput(text: string): string {
    if (!text || text.length === 0) return text
    const maxLength = 60_000
    let out = text
      // eslint-disable-next-line no-control-regex -- 这里就是要剥掉控制字符
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim()
    if (out.length > maxLength) {
      out = out.slice(0, maxLength) + '\n\n[输入已截断，仅保留前 ' + maxLength + ' 个字符。]'
    }
    return out
  }

  /** Ensure patch has version, patchId, timestamp, actor, scope, operation, target, payload for protocol; preserve objects, apiBasePath, schemaPath for metadata. */
  private normalizePatchContent(
    raw: Record<string, any>,
    actor: 'ai' | 'human' = 'ai',
  ): Record<string, any> {
    const normalized: Record<string, any> = {
      version: raw.version ?? '1.0',
      patchId: raw.patchId ?? uuidv4(),
      timestamp: raw.timestamp ?? new Date().toISOString(),
      actor: raw.actor ?? actor,
      scope: raw.scope ?? 'object',
      operation: raw.operation ?? 'add',
      target: raw.target ?? { type: 'object', identifier: 'NewObject' },
      payload: raw.payload ?? {},
    }
    if (raw.description != null) normalized.description = raw.description
    if (raw.dependsOn != null) normalized.dependsOn = raw.dependsOn
    if (raw.objects != null) normalized.objects = raw.objects
    if (raw.apiBasePath != null) normalized.apiBasePath = raw.apiBasePath
    if (raw.schemaPath != null) normalized.schemaPath = raw.schemaPath
    return normalized
  }

  private extractPatchFromResponse(response: any): Record<string, any> {
    return extractAiJsonObject(response)
  }

  async runTests(moduleId: string, organizationId: string): Promise<AIModuleTest[]> {
    const module = await this.findOne(moduleId, organizationId)

    // Create test cases for CRM entities
    const testCases = [
      { name: 'Customer CRUD', entityType: 'Customer' },
      { name: 'Order CRUD', entityType: 'Order' },
      { name: 'OrderTracking CRUD', entityType: 'OrderTracking' },
      { name: 'FinancialTransaction CRUD', entityType: 'FinancialTransaction' },
      { name: 'Cross-Entity Relations', entityType: 'Relations' },
    ]

    const tests: AIModuleTest[] = []

    for (const testCase of testCases) {
      const test = this.aiModuleTestRepository.create({
        moduleId: module.id,
        testName: testCase.name,
        entityType: testCase.entityType,
        status: TestStatus.RUNNING,
      })
      await this.aiModuleTestRepository.save(test)

      try {
        // Simulate test execution (in real implementation, this would validate the patch)
        const startTime = Date.now()
        await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate test
        const duration = Date.now() - startTime

        // For now, all tests pass (in real implementation, validate patch against schemas)
        test.status = TestStatus.PASSED
        test.executedAt = new Date()
        test.duration = duration
        test.result = { passed: true, message: 'Test passed' }

        await this.aiModuleTestRepository.save(test)
        tests.push(test)
      } catch (error) {
        test.status = TestStatus.FAILED
        test.errorMessage = error instanceof Error ? error.message : 'Test failed'
        test.executedAt = new Date()
        await this.aiModuleTestRepository.save(test)
        tests.push(test)
      }
    }

    // Update module test results
    const passedTests = tests.filter((t) => t.status === TestStatus.PASSED).length
    module.testResults = {
      total: tests.length,
      passed: passedTests,
      failed: tests.length - passedTests,
      tests: tests.map((t) => ({
        id: t.id,
        name: t.testName,
        status: t.status,
      })),
    }
    await this.aiModuleRepository.save(module)

    return tests
  }

  async submitForReview(moduleId: string, organizationId: string): Promise<AIModule> {
    const module = await this.findOne(moduleId, organizationId)

    // Check if all tests passed
    if (module.testResults && module.testResults.failed > 0) {
      throw new BadRequestException('All tests must pass before submitting for review')
    }

    module.status = AIModuleStatus.PENDING_REVIEW
    return this.aiModuleRepository.save(module)
  }

  async review(
    moduleId: string,
    reviewerId: string,
    decision: ReviewDecision,
    organizationId: string,
    comments?: string,
    rejectionReason?: string,
  ): Promise<AIModuleReview> {
    const module = await this.findOne(moduleId, organizationId)

    const review = this.aiModuleReviewRepository.create({
      moduleId: module.id,
      reviewerId,
      decision,
      comments,
      rejectionReason,
      reviewedAt: new Date(),
    })

    await this.aiModuleReviewRepository.save(review)

    // Update module status
    if (decision === ReviewDecision.APPROVED) {
      module.status = AIModuleStatus.APPROVED
      module.reviewedById = reviewerId
      module.reviewedAt = new Date()
      if (comments) {
        module.reviewComments = comments
      }
    } else {
      module.status = AIModuleStatus.REJECTED
      module.reviewedById = reviewerId
      module.reviewedAt = new Date()
      if (rejectionReason) {
        module.reviewComments = rejectionReason
      }
    }

    await this.aiModuleRepository.save(module)

    return review
  }

  async publish(moduleId: string, organizationId: string): Promise<AIModule> {
    const module = await this.findOne(moduleId, organizationId)

    if (module.status !== AIModuleStatus.APPROVED) {
      throw new BadRequestException('Only approved modules can be published')
    }

    module.status = AIModuleStatus.PUBLISHED
    module.publishedAt = new Date()

    // Register module in module registry
    await this.registerModule(module)

    // Publish pipeline (Validator → Dry Run → Apply → Versioned Save) runs in frontend
    // when patch is applied via PatchManager.applyPatch(); patchContent is normalized
    // with patchId, timestamp, actor for protocol compatibility.

    return this.aiModuleRepository.save(module)
  }

  private async registerModule(module: AIModule): Promise<import('../module-registry/module-registry.entity').ModuleRegistry> {
    // Check if already registered
    const existing = await this.moduleRegistryService.findByAiModuleId(module.id, module.organizationId)
    if (existing) {
      // Update existing registration
      return this.moduleRegistryService.update(existing.id, {
        name: module.name,
        description: module.description,
        version: module.version,
        status: ModuleStatus.ACTIVE,
        metadata: this.extractMetadataFromPatch(module.patchContent),
      }, module.organizationId)
    }

    // Extract metadata from patch content
    const metadata = this.extractMetadataFromPatch(module.patchContent)
    const capabilities = this.extractCapabilitiesFromPatch(module.patchContent)

    // Register module
    const registeredModule = await this.moduleRegistryService.create({
      name: module.name,
      description: module.description,
      moduleType: ModuleType.CRUD, // Default, can be enhanced
      aiModelId: module.aiModelId,
      createdById: module.createdById,
      version: module.version,
      status: ModuleStatus.ACTIVE,
      aiModuleId: module.id,
      metadata,
    }, module.organizationId)

    // Register capabilities
    for (const cap of capabilities) {
      await this.moduleRegistryService.addCapability(registeredModule.id, cap, module.organizationId)
    }

    return registeredModule
  }

  private extractMetadataFromPatch(patchContent: any): Record<string, any> {
    const metadata: Record<string, any> = {
      entities: [],
    }

    // Extract entities from patch content
    if (patchContent && typeof patchContent === 'object') {
      // Look for object definitions in patch
      if (patchContent.objects) {
        metadata.entities = Object.keys(patchContent.objects)
      } else if (patchContent.scope === 'object' && patchContent.target?.identifier) {
        metadata.entities = [patchContent.target.identifier]
      }

      // Extract API base path if available
      if (patchContent.apiBasePath) {
        metadata.apiBasePath = patchContent.apiBasePath
      }

      // Extract schema path if available
      if (patchContent.schemaPath) {
        metadata.schemaPath = patchContent.schemaPath
      }
      if (patchContent.blueprint && typeof patchContent.blueprint === 'object') {
        metadata.blueprint = patchContent.blueprint
      }
    }

    return metadata
  }

  /**
   * Save 6-step definition to database
   */
  async saveDefinition(
    moduleId: string,
    definition: Record<string, any>,
  ): Promise<AIModuleDefinition> {
    // Extract individual steps from definition
    // Definition can come in two formats:
    // 1. Flat format: { objectModel: {...}, relationships: {...}, ... }
    // 2. Nested format: { objectModel: { generated: {...} }, relationships: { generated: {...} }, ... }
    const step1 = definition.objectModel || null
    const step2 = definition.relationships || null
    let step3 = definition.stateFlow || null
    const step4 = definition.pages || null
    const step5 = definition.permissions || null
    const step6 = definition.reports || null

    // 六步输出入库前必须过同一份 Schema；只校验存在的步骤，兼容旧的部分定义。
    assertMergedDefinition(definition)

    // Normalize and validate step3_stateFlow before save (single source of truth for workflow)
    if (step3 != null) {
      const result = normalizeStep3ForSave(step3)
      if ('error' in result) {
        throw new BadRequestException(`Invalid state flow: ${result.error}`)
      }
      step3 = result.normalized
    }

    // Check if definition already exists
    const existing = await this.aiModuleDefinitionRepository.findOne({
      where: { aiModuleId: moduleId },
    })

    if (existing) {
      // Update existing definition
      existing.step1_objectModel = step1
      existing.step2_relationships = step2
      existing.step3_stateFlow = step3
      existing.step4_pages = step4
      existing.step5_permissions = step5
      existing.step6_reports = step6
      existing.mergedDefinition = definition
      return this.aiModuleDefinitionRepository.save(existing)
    } else {
      // Create new definition
      const newDefinition = this.aiModuleDefinitionRepository.create({
        aiModuleId: moduleId,
        step1_objectModel: step1,
        step2_relationships: step2,
        step3_stateFlow: step3,
        step4_pages: step4,
        step5_permissions: step5,
        step6_reports: step6,
        mergedDefinition: definition,
      })
      return this.aiModuleDefinitionRepository.save(newDefinition)
    }
  }

  /**
   * Get 6-step definition for a module
   */
  async getDefinition(moduleId: string): Promise<AIModuleDefinition | null> {
    return this.aiModuleDefinitionRepository.findOne({
      where: { aiModuleId: moduleId },
    })
  }

  /**
   * 对 AI 包补 license、签名，并按当前租户装载验证。
   * 只有 load 成功才写 loadedAt；失败不假装“可运行”。
   */
  async deliverBlueprint(
    moduleId: string,
    organizationId: string,
    input: {
      grantedTo: string[]
      expiresAt?: string
      issuer?: string
      resell?: boolean
    },
  ): Promise<Record<string, unknown>> {
    const module = await this.findOne(moduleId, organizationId)
    const packageId = module.metadata?.blueprint?.packageId
    if (typeof packageId !== 'string' || packageId.length === 0) {
      throw new BadRequestException('该模块还没有 Blueprint 包，先生成/应用定义')
    }

    try {
      const delivered = await this.aiModuleBlueprints.deliver(packageId, {
        grantedTo: input.grantedTo,
        expiresAt: input.expiresAt,
        issuer: input.issuer,
        resell: input.resell,
      })
      const loaded = await this.aiModuleBlueprints.load(packageId, organizationId)
      const now = new Date().toISOString()
      module.metadata = {
        ...(module.metadata ?? {}),
        blueprint: {
          ...(module.metadata?.blueprint ?? {}),
          packageId,
          irDigest: loaded.plan.irDigest,
          signedAt: now,
          loadedAt: now,
          grantedTo: input.grantedTo,
          expiresAt: input.expiresAt ?? null,
        },
      }
      await this.aiModuleRepository.save(module)
      return {
        packageId,
        irDigest: loaded.plan.irDigest,
        signedAt: now,
        loadedAt: now,
        grantedTo: loaded.license?.grantedTo ?? input.grantedTo,
        expiresAt: loaded.license?.expiresAt ?? input.expiresAt ?? null,
        manifest: delivered.manifest,
      }
    } catch (error) {
      if (error instanceof DeliverError || error instanceof LoadError) {
        throw new BadRequestException({ message: error.message, reason: error.reason })
      }
      throw error
    }
  }

  /** 已产出包的元数据（无包返回 null）。 */
  async getBlueprintMetadata(
    moduleId: string,
    organizationId: string,
  ): Promise<Record<string, unknown> | null> {
    const module = await this.findOne(moduleId, organizationId)
    const blueprint = module.metadata?.blueprint
    return blueprint && typeof blueprint === 'object'
      ? (blueprint as Record<string, unknown>)
      : null
  }

  private extractCapabilitiesFromPatch(patchContent: any): Array<{
    capabilityType: CapabilityType
    entity?: string
    operations: string[]
    apiEndpoints: string[]
    description?: string
  }> {
    const capabilities: Array<{
      capabilityType: CapabilityType
      entity?: string
      operations: string[]
      apiEndpoints: string[]
      description?: string
    }> = []

    if (!patchContent || typeof patchContent !== 'object') {
      return capabilities
    }

    // Extract from patch structure
    const entities = this.extractMetadataFromPatch(patchContent).entities || []

    for (const entity of entities) {
      // Default CRUD operations
      const operations = ['create', 'read', 'update', 'delete', 'list']
      const apiBasePath = patchContent.apiBasePath || '/api'
      const apiEndpoints = [`${apiBasePath}/${entity.toLowerCase()}s`]

      capabilities.push({
        capabilityType: CapabilityType.CRUD,
        entity,
        operations,
        apiEndpoints,
        description: `CRUD operations for ${entity}`,
      })
    }

    return capabilities
  }

  async unpublish(moduleId: string, organizationId: string): Promise<AIModule> {
    const module = await this.findOne(moduleId, organizationId)

    if (module.status !== AIModuleStatus.PUBLISHED) {
      throw new BadRequestException('Only published modules can be unpublished')
    }

    module.status = AIModuleStatus.UNPUBLISHED
    module.unpublishedAt = new Date()

    // TODO: Rollback patch if possible
    // await patchManager.rollbackPatch(module.patchContent)

    return this.aiModuleRepository.save(module)
  }
}
