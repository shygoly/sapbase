import { AssetJobService } from './asset-job.service'
import { DocumentParseJobService } from './document-parse-job.service'
import { AiContentJobService } from './ai-content-job.service'
import { AgentLongTaskJobService } from './agent-long-task-job.service'
import { DataTransferJobService } from './data-transfer-job.service'

function registry() {
  const register = jest.fn()
  return { has: jest.fn(() => false), register }
}

describe('async consumers job types', () => {
  it('asset.process 复用 asset-pipeline', async () => {
    const reg = registry()
    const processing = { process: jest.fn(async () => ({ status: 'ready' })) }
    const service = new AssetJobService(reg as never, processing as never)
    service.onModuleInit()
    expect(reg.register).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'asset.process' }),
    )
    const definition = reg.register.mock.calls[0][0]
    await definition.handler(
      { organizationId: 'org-1', stage: jest.fn(), progress: jest.fn() },
      { assetId: 'asset-1' },
    )
    expect(processing.process).toHaveBeenCalledWith('org-1', 'asset-1')
  })

  it('document.parse 拒绝未就绪/非文本资产', async () => {
    const reg = registry()
    const assets = {
      findOne: jest.fn(async () => ({
        id: 'a1',
        status: 'scanning',
        mimeType: 'application/pdf',
      })),
    }
    const service = new DocumentParseJobService(
      reg as never,
      assets as never,
      { get: jest.fn() } as never,
    )
    service.onModuleInit()
    const definition = reg.register.mock.calls[0][0]
    await expect(
      definition.handler(
        { organizationId: 'org-1', stage: jest.fn(), progress: jest.fn() },
        { assetId: 'a1' },
      ),
    ).rejects.toThrow(/未就绪/)
  })

  it('ai.content.generate 返回文本，不写业务表', async () => {
    const reg = registry()
    const models = {
      findDefault: jest.fn(async () => ({ name: 'DS', model: 'deepseek-chat' })),
      generate: jest.fn(async () => ({
        choices: [{ message: { content: 'generated text' } }],
      })),
    }
    const service = new AiContentJobService(reg as never, models as never, { create: jest.fn() } as never)
    service.onModuleInit()
    const definition = reg.register.mock.calls[0][0]
    const result = await definition.handler(
      { organizationId: 'org-1', stage: jest.fn(), progress: jest.fn() },
      { prompt: 'hello' },
    )
    expect(result.result.text).toBe('generated text')
    expect(models.generate).toHaveBeenCalled()
  })

  it('agent.long_task 只桥接会话事件，不复制 run 状态', async () => {
    const reg = registry()
    const sessions = {
      chat: jest.fn(async () => ({
        conversationId: 'conv-1',
        turnId: 'turn-1',
        events: [{ type: 'turn.end', data: {} }],
      })),
    }
    const service = new AgentLongTaskJobService(reg as never, sessions as never)
    service.onModuleInit()
    const definition = reg.register.mock.calls[0][0]
    const result = await definition.handler(
      {
        organizationId: 'org-1',
        jobId: 'job-1',
        stage: jest.fn(),
        progress: jest.fn(),
      },
      {
        agentRunId: 'run-1',
        userId: 'u1',
        message: 'long task',
        permissions: [],
      },
    )
    expect(sessions.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'u1',
        message: 'long task',
      }),
    )
    expect(result.result).toMatchObject({
      agentRunId: 'run-1',
      conversationId: 'conv-1',
      turnId: 'turn-1',
    })
  })

  it('data.export 只读当前组织记录并限制行数', async () => {
    const reg = registry()
    const records = {
      find: jest.fn(async () => [
        {
          id: 'r1',
          entity: 'Customer',
          state: 'active',
          version: 1,
          data: { name: 'A' },
          createdAt: new Date('2026-01-01'),
        },
      ]),
    }
    const service = new DataTransferJobService(
      reg as never,
      { importMaster: jest.fn() } as never,
      records as never,
      { create: jest.fn() } as never,
    )
    service.onModuleInit()
    expect(reg.register.mock.calls.map((call) => call[0].type).sort()).toEqual([
      'data.export',
      'data.import',
    ])
    const exportDefinition = reg.register.mock.calls.find(
      (call) => call[0].type === 'data.export',
    )[0]
    const result = await exportDefinition.handler(
      { organizationId: 'org-1', stage: jest.fn(), progress: jest.fn() },
      { format: 'json', limit: 10 },
    )
    expect(records.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        take: 10,
      }),
    )
    expect(result.result.count).toBe(1)
  })
})
