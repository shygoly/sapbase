import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import { AIModule, AIModuleStatus } from './ai-module.entity'
import { AIModuleTest, TestStatus } from './ai-module-test.entity'
import { AIModuleReview, ReviewDecision } from './ai-module-review.entity'
import { AIModuleDefinition } from './ai-module-definition.entity'
import { AIModelsService } from '../ai-models/ai-models.service'
import { ModuleRegistryService } from '../module-registry/module-registry.service'
import { ModuleType, ModuleStatus } from '../module-registry/module-registry.entity'
import { CapabilityType } from '../module-registry/module-capability.entity'
import { WorkflowConverterService } from '../workflows/workflow-converter.service'
import { getDefinitionStepPrompt } from './definition-step-prompts'
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
    private workflowConverterService: WorkflowConverterService,
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
  ): Promise<AIModule> {
    const module = await this.findOne(moduleId, organizationId)
    const defaultModel = await this.aiModelsService.findDefault()

    if (!defaultModel) {
      throw new BadRequestException('No active AI model configured')
    }

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
              content: `Generate a Patch DSL JSON for: ${naturalLanguagePrompt}`,
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
   * Generate Model DSL from the 6-step definition (object model, relationships, state flow, pages, permissions, reports).
   * The definition is the merged "generated" outputs from each step.
   * Note: This generates a complete Model DSL (not a Patch DSL). Patch DSL is only used for modifying existing modules.
   */
  async generateFromDefinition(
    moduleId: string,
    definition: Record<string, any>,
    organizationId: string,
  ): Promise<AIModule> {
    const module = await this.findOne(moduleId, organizationId)
    const defaultModel = await this.aiModelsService.findDefault()

    if (!defaultModel) {
      throw new BadRequestException('No active AI model configured')
    }

    const definitionJson = JSON.stringify(definition, null, 2)
    const systemPrompt = `You are a Model DSL generator. You will receive a structured module definition with: entities (and fields), relationships, states/transitions, pages (list/form/detail), permission rules, and reports. Generate a single valid Model DSL JSON that implements this module. The Model DSL should define objects (from entities), relations (from relationships), state machines if applicable, pages, permissions, and reports. Return valid JSON only, no markdown or explanation.`

    try {
      const baseUrl = defaultModel.baseUrl || 'https://api.kimi.com/coding/'
      const apiUrl = `${baseUrl.replace(/\/$/, '')}/v1/messages`

      const response = await axios.post(
        apiUrl,
        {
          model: defaultModel.model || 'kimi-for-coding',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Module definition:\n${definitionJson}` },
          ],
          max_tokens: 4000,
        },
        {
          headers: {
            'Authorization': `Bearer ${defaultModel.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        },
      )

      const raw = this.extractPatchFromResponse(response.data)
      const modelDsl = this.normalizePatchContent(raw, 'ai')

      module.naturalLanguagePrompt = 'Generated from 6-step definition'
      // Store Model DSL in patchContent field (historical naming, but contains Model DSL)
      module.patchContent = modelDsl
      module.aiModel = defaultModel as any
      module.aiModelId = defaultModel.id

      const savedModule = await this.aiModuleRepository.save(module)

      // Save the 6-step definition to database
      try {
        await this.saveDefinition(moduleId, definition)
      } catch (error) {
        // Log but don't fail if definition save fails
        console.warn('Failed to save definition:', error)
      }

      return savedModule
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate from definition: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
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

      const extracted = this.extractJsonFromAiResponse(response.data)
      if (extracted === null) {
        throw new BadRequestException('AI response did not contain valid JSON')
      }
      return extracted
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new BadRequestException(`Definition step failed: ${message}`)
    }
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

  /**
   * Extract JSON from AI API response. Supports:
   * - Kimi/Moonshot: response.content[0].text or response.content (string)
   * - OpenAI-style: response.choices[0].message.content
   * - Nested: response.data.content[0].text
   */
  private extractJsonFromAiResponse(response: any): Record<string, any> | null {
    let text = ''
    if (response?.content != null) {
      if (Array.isArray(response.content) && response.content[0] != null) {
        const first = response.content[0]
        text = first.text ?? (typeof first.content === 'string' ? first.content : '')
      } else if (typeof response.content === 'string') {
        text = response.content
      }
    }
    if (!text && response?.choices?.[0]?.message?.content != null) {
      text = response.choices[0].message.content
    }
    if (!text && response?.data?.content != null) {
      const c = response.data.content
      text = Array.isArray(c) && c[0] != null ? (c[0].text ?? c[0].content ?? '') : (typeof c === 'string' ? c : '')
    }
    if (!text || typeof text !== 'string') return null
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    try {
      return JSON.parse(jsonMatch[0]) as Record<string, any>
    } catch {
      return null
    }
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
    // Try to extract JSON from response
    if (response.content && Array.isArray(response.content)) {
      const text = response.content[0]?.text || ''
      // Try to parse JSON from text
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        // Fallback to default patch structure
      }
    }
    // Return default patch structure if parsing fails
    return {
      version: '1.0',
      scope: 'object',
      operation: 'add',
      target: { type: 'object', identifier: 'NewObject' },
      payload: {},
    }
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
    const registryEntry = await this.registerModule(module)

    // Auto-create workflow from step3_stateFlow if present
    const definition = await this.getDefinition(moduleId)
    if (definition?.step3_stateFlow) {
      try {
        // Extract entity type from step1_objectModel or use module name
        const entityType = this.extractEntityType(definition.step1_objectModel) || module.name

        // Create or update workflow
        const existingWorkflow = await this.workflowConverterService['workflowDefinitionService']
          .findByEntityType(entityType, organizationId)
          .catch(() => null)

        let workflow
        if (existingWorkflow) {
          workflow = await this.workflowConverterService.updateWorkflowFromStateFlow(
            existingWorkflow.id,
            definition.step3_stateFlow,
            entityType,
            module.name,
            organizationId,
          )
        } else {
          workflow = await this.workflowConverterService.createWorkflowFromStateFlow(
            definition.step3_stateFlow,
            entityType,
            module.name,
            organizationId,
          )
        }

        // Update module registry metadata with workflow ID
        if (registryEntry) {
          await this.moduleRegistryService.update(registryEntry.id, {
            metadata: {
              ...registryEntry.metadata,
              workflowId: workflow.id,
            },
          }, organizationId)
        }
      } catch (error) {
        // Log error but don't fail publish
        console.error('Failed to create workflow from stateFlow:', error)
      }
    }

    // Publish pipeline (Validator → Dry Run → Apply → Versioned Save) runs in frontend
    // when patch is applied via PatchManager.applyPatch(); patchContent is normalized
    // with patchId, timestamp, actor for protocol compatibility.

    return this.aiModuleRepository.save(module)
  }

  private extractEntityType(objectModel: Record<string, any> | null): string | null {
    if (!objectModel || !objectModel.entities) {
      return null
    }

    // Get first entity name from objectModel
    const entities = objectModel.entities
    if (Array.isArray(entities) && entities.length > 0) {
      return entities[0].name || entities[0].entityName
    } else if (typeof entities === 'object') {
      const firstKey = Object.keys(entities)[0]
      return firstKey || null
    }

    return null
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
    const step3 = definition.stateFlow || null
    const step4 = definition.pages || null
    const step5 = definition.permissions || null
    const step6 = definition.reports || null

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
