import { BadRequestException } from '@nestjs/common'
import { ModelProfileService } from './model-profile.service'

function model(id: string) {
  return { id, provider: 'deepseek', model: 'deepseek-chat', apiKey: 'k' } as any
}

function setup(options: { defaultModel?: any; modelById?: any } = {}) {
  const models = {
    findDefault: jest.fn(async () => options.defaultModel ?? null),
    findOne: jest.fn(async (id: string) => {
      if (options.modelById && options.modelById.id === id) return options.modelById
      throw new Error('not found')
    }),
  }
  return { service: new ModelProfileService(models as never), models }
}

describe('ModelProfileService', () => {
  afterEach(() => {
    for (const task of ['INTENT', 'DESIGN', 'VISION', 'EVALUATION']) {
      delete process.env[`AGENT_MODEL_PROFILE_${task}`]
    }
  })

  it('AGENT_MODEL_PROFILE_<TASK> 优先于默认模型', async () => {
    process.env.AGENT_MODEL_PROFILE_INTENT = 'model-intent'
    const { service } = setup({
      defaultModel: model('default'),
      modelById: model('model-intent'),
    })
    await expect(service.resolve('intent')).resolves.toMatchObject({
      task: 'intent',
      modelId: 'model-intent',
      source: 'task-profile',
      model: expect.objectContaining({ id: 'model-intent' }),
    })
  })

  it('配置了不存在的模型 → fail-closed，不回退默认', async () => {
    process.env.AGENT_MODEL_PROFILE_DESIGN = 'missing-model'
    const { service } = setup({ defaultModel: model('default') })
    await expect(service.resolve('design')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('未配置 task profile → 默认模型；没有默认 → BadRequest', async () => {
    const { service } = setup({ defaultModel: model('default') })
    await expect(service.resolve('vision')).resolves.toMatchObject({
      modelId: 'default',
      source: 'default',
    })
    const empty = setup()
    await expect(empty.service.resolve('vision')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('list 返回四个任务的 profile 来源', async () => {
    process.env.AGENT_MODEL_PROFILE_EVALUATION = 'model-eval'
    const { service } = setup({
      defaultModel: model('default'),
      modelById: model('model-eval'),
    })
    const list = await service.list()
    expect(list.map((item) => item.task)).toEqual([
      'intent',
      'design',
      'vision',
      'evaluation',
    ])
    expect(list.find((item) => item.task === 'evaluation')).toMatchObject({
      source: 'task-profile',
      modelId: 'model-eval',
    })
  })

  it('未知 task 拒绝', async () => {
    const { service } = setup()
    await expect(service.resolve('unknown' as never)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})
