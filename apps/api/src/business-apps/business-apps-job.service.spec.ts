import { NotFoundException } from '@nestjs/common'
import { BusinessAppsJobService } from './business-apps-job.service'
import { BusinessAppsRunsService } from './business-apps-runs.service'

function registry() {
  return { has: jest.fn(() => false), register: jest.fn() }
}

describe('BusinessAppsJobService', () => {
  it('app.upgrade 使用 job.createdBy 作为操作人，不从 payload 读取', async () => {
    const reg = registry()
    const jobs = { get: jest.fn(async () => ({ createdBy: 'admin-1' })) }
    const apps = {
      upgrade: jest.fn(async () => ({
        id: 'app-1',
        appKey: 'erp',
        blueprintVersion: '1.1.0',
        status: 'active',
      })),
    }
    const service = new BusinessAppsJobService(
      reg as never,
      jobs as never,
      apps as never,
    )
    service.onModuleInit()
    const definition = reg.register.mock.calls[0][0]
    expect(definition).toMatchObject({ type: 'app.upgrade', typeVersion: 1 })
    const result = await definition.handler(
      {
        organizationId: 'org-1',
        jobId: 'job-1',
        stage: jest.fn(),
        progress: jest.fn(),
      },
      { installationId: 'app-1', packageId: 'erp-1.1.0' },
    )
    expect(jobs.get).toHaveBeenCalledWith('org-1', 'job-1')
    expect(apps.upgrade).toHaveBeenCalledWith({
      id: 'app-1',
      organizationId: 'org-1',
      packageId: 'erp-1.1.0',
      userId: 'admin-1',
      actor: 'admin-1',
    })
    expect(result.result).toMatchObject({
      installationId: 'app-1',
      blueprintVersion: '1.1.0',
    })
  })

  it('缺少可信创建人 → 拒绝', async () => {
    const reg = registry()
    const service = new BusinessAppsJobService(
      reg as never,
      { get: jest.fn(async () => ({ createdBy: null })) } as never,
      { upgrade: jest.fn() } as never,
    )
    service.onModuleInit()
    const definition = reg.register.mock.calls[0][0]
    await expect(
      definition.handler(
        {
          organizationId: 'org-1',
          jobId: 'job-1',
          stage: jest.fn(),
          progress: jest.fn(),
        },
        { installationId: 'app-1', packageId: 'erp-1.1.0' },
      ),
    ).rejects.toThrow(/可信创建人/)
  })
})

describe('BusinessAppsRunsService', () => {
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
    return { service: new BusinessAppsRunsService(jobs as never), jobs }
  }

  it('startUpgrade 只入队 app.upgrade', async () => {
    const { service, jobs } = setup()
    await expect(
      service.startUpgrade({
        organizationId: 'org-1',
        installationId: 'app-1',
        packageId: 'erp-1.1.0',
        userId: 'admin-1',
        idempotencyKey: 'upgrade-key',
      }),
    ).resolves.toMatchObject({
      jobId: 'job-1',
      installationId: 'app-1',
      status: 'queued',
      created: true,
    })
    expect(jobs.create).toHaveBeenCalledWith(
      'org-1',
      { userId: 'admin-1', permissions: ['job:app.upgrade:create'] },
      {
        type: 'app.upgrade',
        payload: { installationId: 'app-1', packageId: 'erp-1.1.0' },
        idempotencyKey: 'upgrade-key',
      },
    )
  })

  it('getUpgrade 返回状态/进度/结果；拒绝其他 job 类型', async () => {
    const { service, jobs } = setup()
    jobs.get.mockResolvedValueOnce({
      id: 'job-1',
      type: 'app.upgrade',
      status: 'succeeded',
      progress: 100,
      payload: { installationId: 'app-1' },
      result: { installationId: 'app-1', blueprintVersion: '1.1.0' },
      error: null,
      createdAt: new Date('2026-11-12T00:00:00Z'),
      startedAt: null,
      finishedAt: new Date('2026-11-12T00:01:00Z'),
    })
    await expect(service.getUpgrade('org-1', 'job-1')).resolves.toMatchObject({
      jobId: 'job-1',
      installationId: 'app-1',
      status: 'succeeded',
      progress: 100,
      result: { blueprintVersion: '1.1.0' },
    })
    jobs.get.mockResolvedValueOnce({ id: 'job-2', type: 'agent.long_task' })
    await expect(service.getUpgrade('org-1', 'job-2')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
