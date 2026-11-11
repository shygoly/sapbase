import { BadRequestException } from '@nestjs/common'
import axios from 'axios'
import { AIModelsService } from './ai-models.service'
import { AIModelProvider, AIModelStatus } from './ai-model.entity'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

function model(overrides: Record<string, unknown> = {}) {
  return {
    id: 'model-1',
    name: 'DeepSeek Chat',
    provider: AIModelProvider.DEEPSEEK,
    apiKey: 'test-key',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    status: AIModelStatus.ACTIVE,
    isDefault: true,
    ...overrides,
  } as any
}

function build(row = model()) {
  const repository = {
    findOne: jest.fn(async () => row),
    save: jest.fn(async (value: any) => value),
  }
  return {
    repository,
    service: new AIModelsService(repository as never),
  }
}

describe('AIModelsService provider routing', () => {
  beforeEach(() => jest.clearAllMocks())

  it('DeepSeek 使用 OpenAI 兼容 /chat/completions', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: 'ok' } }] },
    })
    const { service } = build()
    await service.generate(model(), { user: 'hello', maxTokens: 8 })
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/chat/completions',
      expect.objectContaining({ model: 'deepseek-chat', max_tokens: 8 }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    )
  })

  it('Kimi 使用 Anthropic 兼容 /v1/messages', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { content: [{ text: 'ok' }] },
    })
    const { service } = build(
      model({
        provider: AIModelProvider.KIMI,
        baseUrl: 'https://api.kimi.com/coding/',
        model: 'kimi-for-coding',
      }),
    )
    await service.generate(model({
      provider: AIModelProvider.KIMI,
      baseUrl: 'https://api.kimi.com/coding/',
      model: 'kimi-for-coding',
    }), { user: 'hello', maxTokens: 8 })
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.kimi.com/coding/v1/messages',
      expect.objectContaining({ model: 'kimi-for-coding' }),
      expect.any(Object),
    )
  })

  it('连接成功：更新 lastTestedAt 并保持 active', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { choices: [{ message: { content: 'ok' } }] },
    })
    const row = model()
    const { service, repository } = build(row)
    await expect(service.testConnection('model-1')).resolves.toEqual({
      success: true,
      message: 'Connection successful',
    })
    expect(row.lastTestedAt).toBeInstanceOf(Date)
    expect(row.status).toBe(AIModelStatus.ACTIVE)
    expect(repository.save).toHaveBeenCalled()
  })

  it('连接失败：标记 inactive 并返回错误', async () => {
    mockedAxios.post.mockRejectedValue(new Error('401 unauthorized'))
    const row = model()
    const { service, repository } = build(row)
    const result = await service.testConnection('model-1')
    expect(result.success).toBe(false)
    expect(result.message).toContain('401')
    expect(row.status).toBe(AIModelStatus.INACTIVE)
    expect(repository.save).toHaveBeenCalled()
  })

  it('无 API key：直接拒绝 generate', async () => {
    const { service } = build(model({ apiKey: '' }))
    await expect(service.generate(model({ apiKey: '' }), { user: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})
