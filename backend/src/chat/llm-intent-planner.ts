import { AIModelsService } from '../ai-models/ai-models.service'
import { loadToolCatalog, type ToolCatalog } from '../agent-tools/contracts-loader'
import type { ChatContext, Intent, IntentParser } from './chat.types'

/**
 * LLM 意图规划：只从平台提供的工具 catalog 选工具，不生成 SQL、不发明工具。
 * 未配置默认模型或 AGENT_LLM_ENABLED!=true 时返回 null，由上层降级到 L0。
 */
export class LlmIntentPlanner implements IntentParser {
  constructor(
    private readonly models: AIModelsService,
    private readonly catalog: ToolCatalog = loadToolCatalog(),
  ) {}

  async parse(input: { message: string; context: ChatContext }): Promise<Intent | null> {
    if (process.env.AGENT_LLM_ENABLED !== 'true') return null
    const model = await this.models.findDefault()
    if (!model?.baseUrl || !model?.model) return null
    try {
      const response = await fetch(`${model.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: model.model,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content:
                'You are an intent planner. Choose exactly one tool from the provided catalog. ' +
                'Return JSON only: {"tool":"<name>","args":{...}}. Never invent tools, never write SQL.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                message: input.message,
                tools: this.catalog.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                })),
              }),
            },
          ],
        }),
        signal: AbortSignal.timeout(Number(process.env.AGENT_LLM_TIMEOUT_MS ?? 20_000)),
      })
      if (!response.ok) return null
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = payload.choices?.[0]?.message?.content
      if (!content) return null
      const parsed = JSON.parse(content) as { tool?: string; args?: Record<string, unknown> }
      if (!parsed.tool) return null
      const tool = this.catalog.tools.find((item) => item.name === parsed.tool)
      if (!tool) return null
      return {
        id: `llm:${tool.name}`,
        tool: tool.name,
        args: parsed.args ?? {},
        label: tool.description.slice(0, 80),
      }
    } catch {
      return null
    }
  }
}
