import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AIModel, AIModelProvider, AIModelStatus } from './ai-model.entity'
import axios from 'axios'

@Injectable()
export class AIModelsService {
  constructor(
    @InjectRepository(AIModel)
    private aiModelRepository: Repository<AIModel>,
  ) {}

  async findAll(): Promise<AIModel[]> {
    return this.aiModelRepository.find({
      order: { createdAt: 'DESC' },
    })
  }

  async findOne(id: string): Promise<AIModel> {
    const model = await this.aiModelRepository.findOne({ where: { id } })
    if (!model) {
      throw new NotFoundException(`AI Model with ID ${id} not found`)
    }
    return model
  }

  async findDefault(): Promise<AIModel | null> {
    return this.aiModelRepository.findOne({ where: { isDefault: true, status: AIModelStatus.ACTIVE } })
  }

  async create(createDto: Partial<AIModel>): Promise<AIModel> {
    // If setting as default, unset other defaults
    if (createDto.isDefault) {
      await this.aiModelRepository.update({ isDefault: true }, { isDefault: false })
    }

    const model = this.aiModelRepository.create(createDto)
    return this.aiModelRepository.save(model)
  }

  async update(id: string, updateDto: Partial<AIModel>): Promise<AIModel> {
    const model = await this.findOne(id)

    // If setting as default, unset other defaults
    if (updateDto.isDefault && !model.isDefault) {
      await this.aiModelRepository.update({ isDefault: true }, { isDefault: false })
    }

    Object.assign(model, updateDto)
    return this.aiModelRepository.save(model)
  }

  async delete(id: string): Promise<void> {
    const model = await this.findOne(id)
    await this.aiModelRepository.remove(model)
  }

  /**
   * 统一模型调用：
   * - deepseek/openai：OpenAI 兼容 /chat/completions
   * - kimi/anthropic：Anthropic 兼容 /v1/messages（Kimi Coding 代理）
   * 返回原始响应，交由 extractAiJsonObject 兼容两种形状。
   */
  async generate(
    model: AIModel,
    input: {
      system?: string
      user: string
      maxTokens?: number
      timeoutMs?: number
      temperature?: number
    },
  ): Promise<unknown> {
    if (!model.apiKey) {
      throw new BadRequestException('AI model API key is required')
    }
    const messages = [
      ...(input.system ? [{ role: 'system', content: input.system }] : []),
      { role: 'user', content: input.user },
    ]
    const maxTokens = input.maxTokens ?? 2000
    const temperature = input.temperature ?? 0.2
    const timeout = input.timeoutMs ?? 120_000
    const headers = {
      Authorization: `Bearer ${model.apiKey}`,
      'Content-Type': 'application/json',
    }

    if (
      model.provider === AIModelProvider.DEEPSEEK ||
      model.provider === AIModelProvider.OPENAI
    ) {
      const baseUrl = (model.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '')
      const apiUrl = baseUrl.endsWith('/v1')
        ? `${baseUrl}/chat/completions`
        : `${baseUrl}/v1/chat/completions`
      const response = await axios.post(
        apiUrl,
        {
          model:
            model.model ||
            (model.provider === AIModelProvider.DEEPSEEK ? 'deepseek-chat' : 'gpt-4o-mini'),
          messages,
          max_tokens: maxTokens,
          temperature,
        },
        { headers, timeout },
      )
      return response.data
    }

    if (
      model.provider === AIModelProvider.KIMI ||
      model.provider === AIModelProvider.ANTHROPIC
    ) {
      const baseUrl = (model.baseUrl || 'https://api.kimi.com/coding/').replace(/\/+$/, '')
      const response = await axios.post(
        `${baseUrl}/v1/messages`,
        {
          model: model.model || 'kimi-for-coding',
          messages,
          max_tokens: maxTokens,
          temperature,
        },
        { headers, timeout },
      )
      return response.data
    }

    throw new BadRequestException(`Provider ${model.provider} not yet supported`)
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const model = await this.findOne(id)

    if (!model.apiKey) {
      return { success: false, message: 'API key is required' }
    }

    try {
      await this.generate(model, {
        user: 'Reply with the single word: ok',
        maxTokens: 8,
        timeoutMs: 20_000,
        temperature: 0,
      })
      model.lastTestedAt = new Date()
      model.status = AIModelStatus.ACTIVE
      await this.aiModelRepository.save(model)
      return { success: true, message: 'Connection successful' }
    } catch (error) {
      model.status = AIModelStatus.INACTIVE
      await this.aiModelRepository.save(model)
      const message = error instanceof Error ? error.message : 'Connection failed'
      return { success: false, message }
    }
  }}
