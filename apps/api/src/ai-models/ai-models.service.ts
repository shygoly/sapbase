import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { readFileSync } from 'node:fs'
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
    const model = await this.aiModelRepository.findOne({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        name: true,
        provider: true,
        baseUrl: true,
        model: true,
        status: true,
        description: true,
        config: true,
        lastTestedAt: true,
        isDefault: true,
        secretRef: true,
        apiKey: true,
      },
    })
    if (!model) {
      throw new NotFoundException(`AI Model with ID ${id} not found`)
    }
    return model
  }

  async findDefault(): Promise<AIModel | null> {
    return this.aiModelRepository.findOne({
      where: { isDefault: true, status: AIModelStatus.ACTIVE },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        name: true,
        provider: true,
        baseUrl: true,
        model: true,
        status: true,
        description: true,
        config: true,
        lastTestedAt: true,
        isDefault: true,
        secretRef: true,
        apiKey: true,
      },
    })
  }

  /** 对外响应绝不回显 apiKey；只暴露是否已有凭据与引用来源。 */
  toPublic(model: AIModel): Record<string, unknown> {
    const { apiKey: _apiKey, ...rest } = model
    return {
      ...rest,
      hasCredential: Boolean(model.secretRef || model.apiKey),
      credentialSource: model.secretRef ? 'secret-ref' : model.apiKey ? 'legacy-inline' : 'missing',
    }
  }

  /**
   * 解析模型凭据：
   * - secretRef=`env:NAME` → process.env[NAME]
   * - secretRef=`file:/abs/path` → 文件内容（trim）
   * - 旧 `apiKey` 仅作兼容，标记 legacy-inline
   * 失败一律 fail-closed，不把空 key 当可用。
   */
  async resolveCredential(model: AIModel): Promise<{
    apiKey: string
    source: 'secret-ref' | 'legacy-inline'
  }> {
    if (model.secretRef) {
      if (model.secretRef.startsWith('env:')) {
        const name = model.secretRef.slice(4)
        const value = process.env[name]
        if (!value) {
          throw new BadRequestException(`模型密钥引用 ${model.secretRef} 未解析到值`)
        }
        return { apiKey: value, source: 'secret-ref' }
      }
      if (model.secretRef.startsWith('file:')) {
        const path = model.secretRef.slice(5)
        try {
          const value = readFileSync(path, 'utf8').trim()
          if (!value) throw new Error('empty')
          return { apiKey: value, source: 'secret-ref' }
        } catch {
          throw new BadRequestException(`模型密钥文件不可读：${model.secretRef}`)
        }
      }
      throw new BadRequestException('secretRef 只支持 env:NAME 或 file:/path')
    }
    if (model.apiKey) {
      return { apiKey: model.apiKey, source: 'legacy-inline' }
    }
    throw new BadRequestException('AI model API key is required')
  }

  async create(createDto: Partial<AIModel>): Promise<AIModel> {
    // If setting as default, unset other defaults
    if (createDto.isDefault) {
      await this.aiModelRepository.update({ isDefault: true }, { isDefault: false })
    }

    if (createDto.secretRef) {
      assertSecretRef(createDto.secretRef)
      createDto = { ...createDto, apiKey: null as never }
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

    if (updateDto.secretRef) {
      assertSecretRef(updateDto.secretRef)
      updateDto = { ...updateDto, apiKey: null as never }
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
    const credential = await this.resolveCredential(model)
    const messages = [
      ...(input.system ? [{ role: 'system', content: input.system }] : []),
      { role: 'user', content: input.user },
    ]
    const maxTokens = input.maxTokens ?? 2000
    const temperature = input.temperature ?? 0.2
    const timeout = input.timeoutMs ?? 120_000
    const headers = {
      Authorization: `Bearer ${credential.apiKey}`,
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

    try {
      await this.resolveCredential(model)
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'API key is required',
      }
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


function assertSecretRef(ref: string): void {
  if (!ref.startsWith('env:') && !ref.startsWith('file:')) {
    throw new BadRequestException('secretRef 只支持 env:NAME 或 file:/path')
  }
}
