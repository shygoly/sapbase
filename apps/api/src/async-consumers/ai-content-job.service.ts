import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { JobTypeRegistry } from '@sap/platform-core/jobs/job-types'
import { AIModelsService } from '../ai-models/ai-models.service'

function extractText(response: unknown): string {
  const r = response as {
    choices?: Array<{ message?: { content?: unknown } }>
    content?: unknown
  }
  const choice = r?.choices?.[0]?.message?.content
  if (typeof choice === 'string') return choice
  if (Array.isArray(r?.content)) {
    const first = r.content[0] as { text?: unknown } | undefined
    if (typeof first?.text === 'string') return first.text
  }
  if (typeof r?.content === 'string') return r.content
  return ''
}

/** 内容生成任务：复用默认/指定 AI 模型，结果只作为任务产物返回。 */
@Injectable()
export class AiContentJobService implements OnModuleInit {
  constructor(
    private readonly registry: JobTypeRegistry,
    private readonly models: AIModelsService,
  ) {}

  onModuleInit(): void {
    if (this.registry.has('ai.content.generate')) return
    this.registry.register({
      type: 'ai.content.generate',
      typeVersion: 1,
      timeoutMs: 180_000,
      maxAttempts: 2,
      backoff: { kind: 'exponential', baseMs: 5_000, maxMs: 60_000 },
      concurrency: 1,
      payloadSchema: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', minLength: 1, maxLength: 20_000 },
          system: { type: 'string', maxLength: 10_000 },
          modelId: { type: 'string' },
          maxTokens: { type: 'integer', minimum: 1, maximum: 16_000 },
          temperature: { type: 'number', minimum: 0, maximum: 2 },
        },
        additionalProperties: false,
      },
      handler: async (ctx, payload) => {
        const model = payload.modelId
          ? await this.models.findOne(String(payload.modelId))
          : await this.models.findDefault()
        if (!model) throw new BadRequestException('没有可用的 AI 模型')
        await ctx.stage('generating', { model: model.model ?? model.name })
        const response = await this.models.generate(model, {
          system: payload.system ? String(payload.system) : undefined,
          user: String(payload.prompt),
          maxTokens: payload.maxTokens ? Number(payload.maxTokens) : 2000,
          temperature: payload.temperature !== undefined ? Number(payload.temperature) : 0.2,
          timeoutMs: 120_000,
        })
        const text = extractText(response)
        if (!text.trim()) throw new BadRequestException('AI 响应没有文本内容')
        await ctx.progress(100)
        return { result: { model: model.model ?? model.name, text } }
      },
    })
  }
}
