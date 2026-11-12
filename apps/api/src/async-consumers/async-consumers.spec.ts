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
    const jobs = { get: jest.fn(async () => ({ createdBy: 'u1' })) }
    const delegated = {
      resolve: jest.fn(async () => ({
        userId: 'u1',
        permissions: ['tool:blueprint:read'],
      })),
    }
    const service = new AgentLongTaskJobService(
      reg as never,
      jobs as never,
      delegated as never,
      sessions as never,
    )
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
        message: 'long task',
      },
    )
    expect(jobs.get).toHaveBeenCalledWith('org-1', 'job-1')
    expect(delegated.resolve).toHaveBeenCalledWith('org-1', 'u1')
    expect(sessions.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'u1',
        actor: 'u1',
        permissions: ['tool:blueprint:read'],
        message: 'long task',
      }),
    )
    expect(result.result).toMatchObject({
      agentRunId: 'run-1',
      conversationId: 'conv-1',
      turnId: 'turn-1',
    })
  })

  it('agent.long_task 忽略入队 payload 伪造的权限/用户，缺少创建人拒绝', async () => {
    const reg = registry()
    const sessions = {
      chat: jest.fn(async () => ({ conversationId: 'c', turnId: 't', events: [] })),
    }
    const jobs = { get: jest.fn(async () => ({ createdBy: 'real-user' })) }
    const delegated = {
      resolve: jest.fn(async () => ({
        userId: 'real-user',
        permissions: ['tool:blueprint:read'],
      })),
    }
    const service = new AgentLongTaskJobService(
      reg as never,
      jobs as never,
      delegated as never,
      sessions as never,
    )
    service.onModuleInit()
    const definition = reg.register.mock.calls[0][0]
    await definition.handler(
      {
        organizationId: 'org-1',
        jobId: 'job-1',
        stage: jest.fn(),
        progress: jest.fn(),
      },
      {
        agentRunId: 'run-1',
        message: 'long task',
        userId: 'attacker',
        permissions: ['tool:god'],
      },
    )
    expect(delegated.resolve).toHaveBeenCalledWith('org-1', 'real-user')
    expect(sessions.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'real-user',
        permissions: ['tool:blueprint:read'],
      }),
    )

    const missingReg = registry()
    const missingCreator = new AgentLongTaskJobService(
      missingReg as never,
      { get: jest.fn(async () => ({ createdBy: null })) } as never,
      delegated as never,
      sessions as never,
    )
    missingCreator.onModuleInit()
    const missingDefinition = missingReg.register.mock.calls[0][0]
    await expect(
      missingDefinition.handler(
        {
          organizationId: 'org-1',
          jobId: 'job-2',
          stage: jest.fn(),
          progress: jest.fn(),
        },
        { agentRunId: 'run-2', message: 'x' },
      ),
    ).rejects.toThrow(/可信创建人/)
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
