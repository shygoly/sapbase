import { BadRequestException } from '@nestjs/common'
import { ModelGatewayService } from './model-gateway.service'

function model(overrides: Record<string, unknown> = {}) {
  return {
    id: 'model-1',
    name: 'DeepSeek',
    provider: 'deepseek',
    apiKey: 'test-key',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    status: 'active',
    isDefault: true,
    ...overrides,
  } as any
}

function setup(overrides: { row?: any; raw?: unknown } = {}) {
  const row = 'row' in overrides ? overrides.row : model()
  const models = {
    findDefault: jest.fn(async () => row),
    findOne: jest.fn(async () => row),
    generate: jest.fn(async () => overrides.raw ?? { choices: [{ message: { content: 'ok' } }] }),
  }
  return { gateway: new ModelGatewayService(models as never), models }
}

describe('ModelGatewayService', () => {
  it('complete 统一 messages → provider adapter，并返回 trace', async () => {
    const { gateway, models } = setup({
      raw: { choices: [{ message: { content: 'hello' } }] },
    })
    const result = await gateway.complete({
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'hi' },
      ],
      maxTokens: 16,
    })
    expect(result).toMatchObject({
      text: 'hello',
      provider: 'deepseek',
      model: 'deepseek-chat',
      modelRowId: 'model-1',
    })
    expect(result.trace.requestId).toMatch(/[0-9a-f-]{36}/)
    expect(result.trace.latencyMs).toBeGreaterThanOrEqual(0)
    expect(models.generate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'model-1' }),
      expect.objectContaining({
        system: 'system',
        user: 'user: hi',
        maxTokens: 16,
      }),
    )
  })

  it('没有默认模型 → BadRequest', async () => {
    const { gateway } = setup({ row: null })
    await expect(
      gateway.complete({ messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('stream 无 baseUrl 时降级为单 chunk', async () => {
    const { gateway } = setup({
      row: model({ baseUrl: null }),
      raw: { choices: [{ message: { content: 'fallback' } }] },
    })
    const chunks = []
    for await (const chunk of gateway.stream({
      messages: [{ role: 'user', content: 'x' }],
    })) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual([
      expect.objectContaining({ delta: 'fallback', done: true }),
    ])
  })

  it('stream 解析 OpenAI SSE delta', async () => {
    const originalFetch = global.fetch
    const encoder = new TextEncoder()
    global.fetch = jest.fn(async () => ({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"hel"}}]}\n\n',
            ),
          )
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n' +
                'data: [DONE]\n\n',
            ),
          )
          controller.close()
        },
      }),
    })) as never
    try {
      const { gateway } = setup()
      const deltas = []
      for await (const chunk of gateway.stream({
        messages: [{ role: 'user', content: 'x' }],
      })) {
        if (!chunk.done) deltas.push(chunk.delta)
      }
      expect(deltas).toEqual(['hel', 'lo'])
    } finally {
      global.fetch = originalFetch
    }
  })
})
