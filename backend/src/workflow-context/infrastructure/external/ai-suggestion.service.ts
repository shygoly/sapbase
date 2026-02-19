import { Injectable } from '@nestjs/common'
import { AIModelsService } from '../../../ai-models/ai-models.service'
import type {
  IAiSuggestionService,
  SuggestedTransition,
} from '../../domain/services'
import axios from 'axios'

const SUGGESTION_TIMEOUT_MS = 8000

@Injectable()
export class AiSuggestionService implements IAiSuggestionService {
  constructor(private readonly aiModelsService: AIModelsService) {}

  async getSuggestedTransitions(
    instanceId: string,
    organizationId: string,
    context: {
      currentState: string
      entityType: string
      toStates: string[]
    },
    entitySnapshot?: Record<string, unknown>,
  ): Promise<SuggestedTransition[]> {
    const defaultModel = await this.aiModelsService.findDefault()
    if (!defaultModel?.apiKey) {
      return []
    }

    const prompt = this.buildSuggestionPrompt(context, entitySnapshot)

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
              content:
                'You recommend 1-2 next workflow transitions. Reply with valid JSON only: { "suggestions": [ { "toState": "stateName", "reason": "short reason" } ] }. No markdown.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 512,
        },
        {
          headers: {
            Authorization: `Bearer ${defaultModel.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: SUGGESTION_TIMEOUT_MS,
        },
      )

      return this.extractSuggestions(response.data, context.toStates)
    } catch {
      return []
    }
  }

  private buildSuggestionPrompt(
    context: { currentState: string; entityType: string; toStates: string[] },
    entitySnapshot?: Record<string, unknown>,
  ): string {
    const parts = [
      `Current workflow state: ${context.currentState}`,
      `Entity type: ${context.entityType}`,
      `Possible next states: ${context.toStates.join(', ')}`,
    ]
    if (entitySnapshot && Object.keys(entitySnapshot).length > 0) {
      parts.push(`Entity data: ${JSON.stringify(entitySnapshot)}`)
    }
    parts.push(
      '\nRecommend 1-2 best next states with a short reason for each. Reply with JSON: { "suggestions": [ { "toState": "...", "reason": "..." } ] }',
    )
    return parts.join('\n')
  }

  private extractSuggestions(
    data: any,
    validToStates: string[],
  ): SuggestedTransition[] {
    if (!data) return []
    const content =
      data.choices?.[0]?.message?.content ??
      data.content?.[0]?.text ??
      (typeof data === 'string' ? data : '')
    const str = typeof content === 'string' ? content.trim() : String(content)
    const jsonMatch = str.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return []
    try {
      const obj = JSON.parse(jsonMatch[0])
      const list = Array.isArray(obj.suggestions) ? obj.suggestions : []
      return list
        .filter((s: any) => s && validToStates.includes(s.toState))
        .slice(0, 2)
        .map((s: any) => ({
          toState: s.toState,
          reason: typeof s.reason === 'string' ? s.reason : '',
        }))
    } catch {
      return []
    }
  }
}
