import { NotFoundException } from '@nestjs/common'
import { AgentRunsService } from './agent-runs.service'

function setup() {
  const jobs = {
    create: jest.fn(async (_org: string, _actor: unknown, input: any) => ({
      created: true,
      job: {
        id: 'job-1',
        type: input.type,
        status: 'queued',
        payload: input.payload,
        progress: 0,
        result: null,
        error: null,
        createdAt: new Date('2026-11-12T00:00:00Z'),
        startedAt: null,
        finishedAt: null,
      },
    })),
    get: jest.fn(),
  }
  return { service: new AgentRunsService(jobs as never), jobs }
}

describe('AgentRunsService', () => {
  it('start 只入队 agent.long_task 并立即返回 jobId', async () => {
    const { service, jobs } = setup()
    const result = await service.start({
      organizationId: 'org-1',
      userId: 'u1',
      message: '长任务',
      conversationId: 'conv-1',
      appKey: 'erp',
      appInstallationId: 'app-1',
      screenContext: { route: '/dashboard' },
      idempotencyKey: 'run-key-1',
    })
    expect(result).toMatchObject({
      jobId: 'job-1',
      conversationId: 'conv-1',
      status: 'queued',
      created: true,
    })
    expect(result.agentRunId).toMatch(/[0-9a-f-]{36}/)
    const [organizationId, actor, input] = jobs.create.mock.calls[0]
    expect(organizationId).toBe('org-1')
    expect(actor).toEqual({
      userId: 'u1',
      permissions: ['job:agent.long_task:create'],
    })
    expect(input).toMatchObject({
      type: 'agent.long_task',
      idempotencyKey: 'run-key-1',
      appInstallationId: 'app-1',
      payload: {
        agentRunId: result.agentRunId,
        message: '长任务',
        conversationId: 'conv-1',
        appKey: 'erp',
        appInstallationId: 'app-1',
        screenContext: { route: '/dashboard' },
      },
    })
    expect(input.payload).not.toHaveProperty('permissions')
    expect(input.payload).not.toHaveProperty('userId')
  })

  it('相同 idempotencyKey 复用已有 job 时返回原 agentRunId', async () => {
    const { service, jobs } = setup()
    jobs.create.mockResolvedValueOnce({
      created: false,
      job: {
        id: 'job-existing',
        type: 'agent.long_task',
        status: 'succeeded',
        payload: { agentRunId: 'run-existing', conversationId: 'conv-existing' },
        progress: 100,
        result: null,
        error: null,
        createdAt: new Date('2026-11-12T00:00:00Z'),
        startedAt: null,
        finishedAt: null,
      },
    })
    await expect(
      service.start({
        organizationId: 'org-1',
        userId: 'u1',
        message: '重复请求',
        idempotencyKey: 'same-key',
      }),
    ).resolves.toMatchObject({
      jobId: 'job-existing',
      agentRunId: 'run-existing',
      conversationId: 'conv-existing',
      created: false,
    })
  })

  it('get 返回 job 状态/进度/结果，并识别 agentRunId', async () => {
    const { service, jobs } = setup()
    jobs.get.mockResolvedValueOnce({
      id: 'job-1',
      type: 'agent.long_task',
      status: 'completed',
      progress: 100,
      payload: { agentRunId: 'run-1', conversationId: 'conv-1' },
      result: {
        agentRunId: 'run-1',
        conversationId: 'conv-1',
        turnId: 'turn-1',
        events: [],
      },
      error: null,
      createdAt: new Date('2026-11-12T00:00:00Z'),
      startedAt: new Date('2026-11-12T00:00:01Z'),
      finishedAt: new Date('2026-11-12T00:00:02Z'),
    })
    await expect(service.get('org-1', 'job-1')).resolves.toMatchObject({
      jobId: 'job-1',
      agentRunId: 'run-1',
      conversationId: 'conv-1',
      status: 'completed',
      progress: 100,
      result: { turnId: 'turn-1' },
      createdAt: '2026-11-12T00:00:00.000Z',
      finishedAt: '2026-11-12T00:00:02.000Z',
    })
  })

  it('get 拒绝非 agent.long_task job，避免跨类型读取', async () => {
    const { service, jobs } = setup()
    jobs.get.mockResolvedValueOnce({ id: 'job-2', type: 'asset.process' })
    await expect(service.get('org-1', 'job-2')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
