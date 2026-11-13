import { BadRequestException, ConflictException } from '@nestjs/common'
import { AgentRuntimeService } from './agent-runtime.service'
import { AgentRun } from './entities/agent-run.entity'

function setup() {
  const definitions: any[] = []
  const instances: any[] = []
  const runs: any[] = []
  const steps: any[] = []
  const waits: any[] = []
  let seq = 0

  const definitionsRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      definitions.find(
        (row) =>
          (where.id === undefined || row.id === where.id) &&
          (where.organizationId === undefined ||
            row.organizationId === where.organizationId),
      ) ?? null,
    ),
    create: jest.fn((row: any) => ({ id: `def-${definitions.length + 1}`, ...row })),
    save: jest.fn(async (row: any) => {
      const index = definitions.findIndex((item) => item.id === row.id)
      if (index >= 0) definitions[index] = row
      else definitions.push(row)
      return row
    }),
    find: jest.fn(async () => definitions),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(async () => ({ version: definitions.length })),
    })),
  }
  const instancesRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      instances.find(
        (row) =>
          (where.id === undefined || row.id === where.id) &&
          (where.organizationId === undefined ||
            row.organizationId === where.organizationId) &&
          (where.appKey === undefined || row.appKey === where.appKey) &&
          (where.userId === undefined || row.userId === where.userId) &&
          (where.definitionId === undefined ||
            row.definitionId === where.definitionId),
      ) ?? null,
    ),
    create: jest.fn((row: any) => ({ id: `inst-${instances.length + 1}`, ...row })),
    save: jest.fn(async (row: any) => {
      const index = instances.findIndex((item) => item.id === row.id)
      if (index >= 0) instances[index] = row
      else instances.push(row)
      return row
    }),
  }
  const runsRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      runs.find(
        (row) =>
          row.id === where.id &&
          (where.organizationId === undefined ||
            row.organizationId === where.organizationId),
      ) ?? null,
    ),
    create: jest.fn((row: any) => ({ id: `run-${runs.length + 1}`, ...row })),
    save: jest.fn(async (row: any) => {
      const index = runs.findIndex((item) => item.id === row.id)
      if (index >= 0) runs[index] = row
      else runs.push(row)
      return row
    }),
  }
  const stepsRepo = {
    manager: {
      query: jest.fn(async (_sql: string, params: any[]) => {
        const [organizationId, runId, type, status, payload] = params
        const seq = steps.length + 1
        const row = {
          id: `step-${seq}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          organizationId,
          runId,
          seq,
          type,
          status,
          payload: JSON.parse(payload),
        }
        steps.push(row)
        return [row]
      }),
    },
    create: jest.fn((row: any) => row),
    save: jest.fn(async (row: any) => {
      steps.push(row)
      return row
    }),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(async () => ({ seq: steps.length })),
      getMany: jest.fn(async () => steps),
    })),
  }
  const waitsRepo = {
    create: jest.fn((row: any) => ({ id: `wait-${waits.length + 1}`, ...row })),
    save: jest.fn(async (row: any) => {
      const index = waits.findIndex((item) => item.id === row.id)
      if (index >= 0) waits[index] = row
      else waits.push(row)
      return row
    }),
    findOne: jest.fn(async ({ where }: any) =>
      waits.find(
        (row) =>
          row.runId === where.runId &&
          row.organizationId === where.organizationId &&
          (where.status === undefined || row.status === where.status),
      ) ?? null,
    ),
    update: jest.fn(async (where: any, patch: any) => {
      for (const row of waits) {
        if (
          row.runId === where.runId &&
          row.organizationId === where.organizationId &&
          row.status === where.status
        ) {
          Object.assign(row, patch)
        }
      }
      return { affected: 1 }
    }),
  }
  const dataSource = {
    query: jest.fn(async () => [{ id: 'app-1' }]),
    transaction: jest.fn(async (fn: any) =>
      fn({
        getRepository: (entity: any) => (entity === AgentRun ? runsRepo : stepsRepo),
        query: jest.fn(async () => [{ seq: steps.length }]),
      }),
    ),
  }
  const service = new AgentRuntimeService(
    definitionsRepo as never,
    instancesRepo as never,
    runsRepo as never,
    stepsRepo as never,
    waitsRepo as never,
    dataSource as never,
  )
  return {
    service,
    definitions,
    instances,
    runs,
    steps,
    waits,
    definitionsRepo,
    instancesRepo,
    runsRepo,
    waitsRepo,
    dataSource,
  }
}

async function publishedInstance(service: AgentRuntimeService) {
  const definition = await service.createDefinition({
    organizationId: 'org-1',
    key: 'support',
    name: 'Support',
    role: 'support',
  })
  await service.publishDefinition('org-1', definition.id)
  const instance = await service.createInstance({
    organizationId: 'org-1',
    appKey: 'crm',
    appInstallationId: 'app-1',
    userId: 'u1',
    definitionId: definition.id,
  })
  return { definition, instance }
}

describe('AgentRuntimeService', () => {
  it('definition/instance/app-scoped 创建', async () => {
    const { service, dataSource } = setup()
    const { definition, instance } = await publishedInstance(service)
    expect(definition.status).toBe('published')
    expect(instance).toMatchObject({
      appKey: 'crm',
      appInstallationId: 'app-1',
      userId: 'u1',
      definitionId: definition.id,
      status: 'active',
    })
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('app_installations'),
      ['app-1', 'org-1'],
    )

    const draft = await service.createDefinition({
      organizationId: 'org-1',
      key: 'draft',
      name: 'Draft',
      role: 'draft',
    })
    await expect(
      service.createInstance({
        organizationId: 'org-1',
        appKey: 'crm',
        userId: 'u1',
        definitionId: draft.id,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('run 状态机：queued→running→waiting→queued→completed，事件带递增 seq', async () => {
    const { service, steps } = setup()
    const { instance } = await publishedInstance(service)
    const run = await service.startRun({
      organizationId: 'org-1',
      agentInstanceId: instance.id,
      input: { message: 'hello' },
    })
    expect(run.status).toBe('running')
    await service.wait('org-1', run.id, { kind: 'user', prompt: 'confirm?' })
    expect((await service.getRun('org-1', run.id)).status).toBe('waiting_user')
    await service.resume('org-1', run.id, { approved: true })
    expect((await service.getRun('org-1', run.id)).status).toBe('queued')
    await service.transition('org-1', run.id, 'running', { reason: 'resume-exec' })
    const completed = await service.complete('org-1', run.id, { text: 'done' })
    expect(completed.status).toBe('completed')
    expect(steps.map((step) => step.seq)).toEqual([1, 2, 3, 4, 5, 6])
    expect(steps.map((step) => step.type)).toEqual([
      'run.queued',
      'run.running',
      'run.waiting_user',
      'run.queued',
      'run.running',
      'run.completed',
    ])
  })

  it('非法状态迁移拒绝', async () => {
    const { service } = setup()
    const { instance } = await publishedInstance(service)
    const run = await service.startRun({
      organizationId: 'org-1',
      agentInstanceId: instance.id,
    })
    await service.complete('org-1', run.id, {})
    await expect(
      service.transition('org-1', run.id, 'running'),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('cancel 取消 pending wait；listEvents 可按 after 重放', async () => {
    const { service, waits } = setup()
    const { instance } = await publishedInstance(service)
    const run = await service.startRun({
      organizationId: 'org-1',
      agentInstanceId: instance.id,
    })
    await service.wait('org-1', run.id, { kind: 'external' })
    expect(waits[0].status).toBe('pending')
    await service.cancel('org-1', run.id)
    expect(waits[0].status).toBe('cancelled')
    expect((await service.getRun('org-1', run.id)).status).toBe('cancelled')
    const events = await service.listEvents('org-1', run.id)
    expect(events.length).toBeGreaterThan(0)
  })
})
