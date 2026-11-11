import { Injectable, BadRequestException } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { AIModelsService } from '../../../ai-models/ai-models.service'
import { extractAiJsonObject } from '../../../ai-modules/ai-response'
import type { IAIModelService, AIModel } from '../../domain/services'

@Injectable()
export class AIModelService implements IAIModelService {
  constructor(private readonly aiModelsService: AIModelsService) {}

  async findDefault(): Promise<AIModel | null> {
    const model = await this.aiModelsService.findDefault()
    if (!model) return null
    return {
      id: model.id,
      name: model.name,
      model: model.model || 'kimi-for-coding',
      baseUrl: model.baseUrl,
      apiKey: model.apiKey,
    }
  }

  async generatePatch(prompt: string, context?: string): Promise<Record<string, any>> {
    const defaultModel = await this.aiModelsService.findDefault()
    if (!defaultModel) {
      throw new BadRequestException('No active AI model configured')
    }

    let userContent = `Generate a Patch DSL JSON for: ${prompt}`
    if (context) {
      userContent += `\n\n${context}`
    }

    try {
      const responseData = await this.aiModelsService.generate(defaultModel, {
        system:
          'You are a Patch DSL generator. Generate valid Patch DSL JSON from natural language descriptions.',
        user: userContent,
        maxTokens: 2000,
        temperature: 0.2,
      })

      const raw = this.extractPatchFromResponse(responseData)
      return this.normalizePatchContent(raw, 'ai')
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate patch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async generateFromDefinition(definition: Record<string, any>): Promise<Record<string, any>> {
    const defaultModel = await this.aiModelsService.findDefault()
    if (!defaultModel) {
      throw new BadRequestException('No active AI model configured')
    }

    const definitionJson = JSON.stringify(definition, null, 2)
    const systemPrompt = `You are a Model DSL generator. You will receive a structured module definition with: entities (and fields), relationships, states/transitions, pages (list/form/detail), permission rules, and reports. Generate a single valid Model DSL JSON that implements this module. The Model DSL should define objects (from entities), relations (from relationships), state machines if applicable, pages, permissions, and reports. Return valid JSON only, no markdown or explanation.`

    try {
      const responseData = await this.aiModelsService.generate(defaultModel, {
        system: systemPrompt,
        user: `Module definition:\n${definitionJson}`,
        maxTokens: 4000,
        temperature: 0.2,
        timeoutMs: 120_000,
      })

      const raw = this.extractPatchFromResponse(responseData)
      return this.normalizePatchContent(raw, 'ai')
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate from definition: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  private extractPatchFromResponse(response: any): Record<string, any> {
    return extractAiJsonObject(response)
  }

  private normalizePatchContent(
    raw: Record<string, any>,
    actor: 'ai' | 'human' = 'ai',
  ): Record<string, any> {
    // Some providers wrap the patch as {"patch": {...}} instead of the protocol shape.
    const wrapped =
      raw.patch && typeof raw.patch === 'object' && !Array.isArray(raw.patch)
        ? (raw.patch as Record<string, any>)
        : null
    const payload =
      raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
        ? raw.payload
        : wrapped ?? {}
    const identifier =
      (wrapped?.module as string | undefined) ??
      (wrapped?.entity as string | undefined) ??
      (wrapped?.identifier as string | undefined) ??
      ((raw.target as Record<string, any> | undefined)?.identifier as string | undefined) ??
      'NewObject'
    const normalized: Record<string, any> = {
      version: raw.version ?? '1.0',
      patchId: raw.patchId ?? uuidv4(),
      timestamp: raw.timestamp ?? new Date().toISOString(),
      actor: raw.actor ?? actor,
      scope: raw.scope ?? 'object',
      operation: raw.operation ?? 'add',
      target: raw.target ?? { type: 'object', identifier },
      payload,
    }
    if (raw.description != null) normalized.description = raw.description
    if (raw.dependsOn != null) normalized.dependsOn = raw.dependsOn
    if (raw.objects != null) normalized.objects = raw.objects
    if (raw.apiBasePath != null) normalized.apiBasePath = raw.apiBasePath
    if (raw.schemaPath != null) normalized.schemaPath = raw.schemaPath
    return normalized
  }
}
