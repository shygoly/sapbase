import { BadRequestException, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { AIModelsService } from './ai-models.service'
import type { AIModel } from './ai-model.entity'

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ModelRequest {
  model?: AIModel
  modelId?: string
  messages: ModelMessage[]
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  metadata?: Record<string, unknown>
}

export interface ModelResponse {
  text: string
  raw: unknown
  provider: string
  model: string
  modelRowId: string
  trace: {
    requestId: string
    provider: string
    model: string
    latencyMs: number
    requestedModelId: string | null
  }
}

export interface ModelChunk {
  delta: string
  done: boolean
  trace: ModelResponse['trace']
}

/**
 * Provider-neutral model gateway（5.1）。
 *
 * 消费方只依赖 `complete` / `stream`，不直接拼 provider URL 或 headers；
 * 具体 provider 仍由 `AIModelsService` 的 adapter 选择。`stream` 只在
 * provider 支持 SSE 时透传，否则降级为一次 complete + 单 chunk（消费方
 * 不必区分）。
 */
@Injectable()
export class ModelGatewayService {
  constructor(private readonly models: AIModelsService) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const model = await this.resolveModel(request)
    const started = Date.now()
    const requestId = randomUUID()
    const raw = await this.models.generate(model, {
      system: systemPrompt(request.messages),
      user: userPrompt(request.messages),
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      timeoutMs: request.timeoutMs,
    })
    return {
      text: extractText(raw),
      raw,
      provider: model.provider,
      model: model.model ?? '',
      modelRowId: model.id,
      trace: {
        requestId,
        provider: model.provider,
        model: model.model ?? '',
        latencyMs: Date.now() - started,
        requestedModelId: request.modelId ?? model.id ?? null,
      },
    }
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelChunk> {
    const model = await this.resolveModel(request)
    const started = Date.now()
    const requestId = randomUUID()
    const trace = (): ModelResponse['trace'] => ({
      requestId,
      provider: model.provider,
      model: model.model ?? '',
      latencyMs: Date.now() - started,
      requestedModelId: request.modelId ?? model.id ?? null,
    })
    if (!model.apiKey || !model.baseUrl) {
      const response = await this.complete(request)
      yield { delta: response.text, done: true, trace: response.trace }
      return
    }
    const provider = model.provider
    const baseUrl = model.baseUrl.replace(/\/+$/, '')
    const url =
      provider === 'kimi' || provider === 'anthropic'
        ? `${baseUrl}/v1/messages`
        : baseUrl.endsWith('/v1')
          ? `${baseUrl}/chat/completions`
          : `${baseUrl}/v1/chat/completions`
    const body =
      provider === 'kimi' || provider === 'anthropic'
        ? {
            model: model.model ?? 'kimi-for-coding',
            messages: request.messages,
            max_tokens: request.maxTokens ?? 2000,
            temperature: request.temperature ?? 0.2,
            stream: true,
          }
        : {
            model: model.model ?? 'deepseek-chat',
            messages: request.messages,
            max_tokens: request.maxTokens ?? 2000,
            temperature: request.temperature ?? 0.2,
            stream: true,
          }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(request.timeoutMs ?? 120_000),
    })
    if (!response.ok || !response.body) {
      const fallback = await this.complete(request)
      yield { delta: fallback.text, done: true, trace: fallback.trace }
      return
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const parsed = JSON.parse(payload) as Record<string, any>
            const delta =
              parsed.choices?.[0]?.delta?.content ??
              parsed.delta?.text ??
              parsed.content_block?.text ??
              ''
            if (typeof delta === 'string' && delta.length > 0) {
              yield { delta, done: false, trace: trace() }
            }
          } catch {
            // 非 JSON SSE 事件忽略；不把网络噪声当模型输出。
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
    yield { delta: '', done: true, trace: trace() }
  }

  private async resolveModel(request: ModelRequest): Promise<AIModel> {
    const model =
      request.model ??
      (request.modelId ? await this.models.findOne(request.modelId) : await this.models.findDefault())
    if (!model) {
      throw new BadRequestException('没有可用模型：请指定 modelId 或配置默认模型')
    }
    if (!model.apiKey) {
      throw new BadRequestException('AI model API key is required')
    }
    return model
  }
}

function systemPrompt(messages: ModelMessage[]): string | undefined {
  const parts = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
  return parts.length > 0 ? parts.join('\n') : undefined
}

function userPrompt(messages: ModelMessage[]): string {
  const parts = messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role}: ${message.content}`)
  return parts.join('\n') || messages.map((message) => message.content).join('\n')
}

function extractText(raw: unknown): string {
  const response = raw as {
    content?: unknown
    choices?: Array<{ message?: { content?: unknown } }>
    data?: { content?: unknown }
  }
  if (Array.isArray(response?.content) && response.content[0] != null) {
    const first = response.content[0] as { text?: unknown; content?: unknown }
    const text = first.text ?? first.content
    if (typeof text === 'string') return text
  }
  if (typeof response?.content === 'string') return response.content
  const choice = response?.choices?.[0]?.message?.content
  if (typeof choice === 'string') return choice
  const nested = response?.data?.content
  if (Array.isArray(nested) && nested[0] != null) {
    const first = nested[0] as { text?: unknown; content?: unknown }
    const text = first.text ?? first.content
    if (typeof text === 'string') return text
  }
  return typeof nested === 'string' ? nested : ''
}
