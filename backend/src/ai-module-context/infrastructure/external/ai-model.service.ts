import { Injectable, BadRequestException } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { AIModelsService } from '../../../ai-models/ai-models.service'
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
    const defaultModel = await this.findDefault()
    if (!defaultModel) {
      throw new BadRequestException('No active AI model configured')
    }

    let userContent = `Generate a Patch DSL JSON for: ${prompt}`
    if (context) {
      userContent += `\n\n${context}`
    }

    try {
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
            Authorization: `Bearer ${defaultModel.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      )

      const raw = this.extractPatchFromResponse(response.data)
      return this.normalizePatchContent(raw, 'ai')
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate patch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  async generateFromDefinition(definition: Record<string, any>): Promise<Record<string, any>> {
    const defaultModel = await this.findDefault()
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
            Authorization: `Bearer ${defaultModel.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        },
      )

      const raw = this.extractPatchFromResponse(response.data)
      return this.normalizePatchContent(raw, 'ai')
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate from definition: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  private extractPatchFromResponse(response: any): Record<string, any> {
    if (response.content && Array.isArray(response.content)) {
      const text = response.content[0]?.text || ''
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        // Fallback to default patch structure
      }
    }
    return {
      version: '1.0',
      scope: 'object',
      operation: 'add',
      target: { type: 'object', identifier: 'NewObject' },
      payload: {},
    }
  }

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
}
