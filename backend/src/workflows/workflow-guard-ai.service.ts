import { Injectable } from '@nestjs/common'
import { AIModelsService } from '../ai-models/ai-models.service'
import { WorkflowInstance } from './workflow-instance.entity'
import { WorkflowTransition } from './workflow-definition.entity'
import axios from 'axios'

const GUARD_TIMEOUT_MS = 5000

export interface AiGuardResult {
  allowed: boolean
  reason?: string
  model?: string
  error?: string
}

@Injectable()
export class WorkflowGuardAiService {
  constructor(private aiModelsService: AIModelsService) {}

  /**
   * Evaluate whether a transition is allowed using AI.
   * Returns { allowed, reason } with optional model/error for audit.
   */
  async evaluateGuard(
    entity: Record<string, any> | undefined,
    instance: WorkflowInstance,
    transition: WorkflowTransition,
    toState: string,
  ): Promise<AiGuardResult> {
    const defaultModel = await this.aiModelsService.findDefault()
    if (!defaultModel?.apiKey) {
      return { allowed: false, reason: 'No AI model configured', error: 'No default model' }
    }

    const prompt = this.buildGuardPrompt(entity, instance, transition, toState)
    const baseUrl = defaultModel.baseUrl || 'https://api.kimi.com/coding/'
    const apiUrl = `${baseUrl.replace(/\/$/, '')}/v1/messages`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), GUARD_TIMEOUT_MS)

      const response = await axios.post(
        apiUrl,
        {
          model: defaultModel.model || 'kimi-for-coding',
          messages: [
            {
              role: 'system',
              content:
                'You decide if a workflow transition is allowed. Reply with valid JSON only: { "allowed": true or false, "reason": "short explanation" }. No markdown.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 256,
        },
        {
          headers: {
            Authorization: `Bearer ${defaultModel.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          timeout: GUARD_TIMEOUT_MS,
        },
      )

      clearTimeout(timeoutId)

      const parsed = this.extractGuardResponse(response.data)
      return {
        allowed: parsed.allowed === true,
        reason: parsed.reason,
        model: defaultModel.model ?? undefined,
      }
    } catch (error: any) {
      const message = error?.message ?? (error?.response?.data as any)?.message ?? 'AI guard evaluation failed'
      return {
        allowed: false,
        reason: message,
        error: message,
        model: defaultModel?.model ?? undefined,
      }
    }
  }

  private buildGuardPrompt(
    entity: Record<string, any> | undefined,
    instance: WorkflowInstance,
    transition: WorkflowTransition,
    toState: string,
  ): string {
    const parts = [
      `Current state: ${instance.currentState}`,
      `Target state: ${toState}`,
      `Transition: ${transition.from} → ${transition.to}`,
    ]
    if (entity && Object.keys(entity).length > 0) {
      parts.push(`Entity data: ${JSON.stringify(entity)}`)
    }
    if (instance.context && Object.keys(instance.context).length > 0) {
      parts.push(`Workflow context: ${JSON.stringify(instance.context)}`)
    }
    const customPrompt = transition.guard?.startsWith('ai_guard:')
      ? transition.guard.slice('ai_guard:'.length).trim()
      : null
    if (customPrompt) {
      parts.push(`Additional rule: ${customPrompt}`)
    }
    parts.push('\nShould this transition be allowed? Reply with JSON: { "allowed": true|false, "reason": "..." }')
    return parts.join('\n')
  }

  private extractGuardResponse(data: any): { allowed: boolean; reason?: string } {
    if (!data) return { allowed: false, reason: 'Empty response' }
    const content =
      data.choices?.[0]?.message?.content ??
      data.content?.[0]?.text ??
      (typeof data === 'string' ? data : '')
    const str = typeof content === 'string' ? content.trim() : String(content)
    const jsonMatch = str.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { allowed: false, reason: 'No JSON in response' }
    try {
      const obj = JSON.parse(jsonMatch[0])
      return {
        allowed: obj.allowed === true,
        reason: typeof obj.reason === 'string' ? obj.reason : undefined,
      }
    } catch {
      return { allowed: false, reason: 'Invalid JSON in response' }
    }
  }
}
