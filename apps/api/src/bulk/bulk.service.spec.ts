import { ForbiddenException } from '@nestjs/common'
import { BulkService, type BulkActor } from './bulk.service'
import type { BulkAdapterRegistry } from './bulk.registry'
import type { ExportRun, ImportRun } from './bulk.entities'
import type { ResourceDescriptor } from './bulk.types'

const actor: BulkActor = { id: 'user-1', permissions: ['imports:manage', 'exports:manage'] }

const descriptor: ResourceDescriptor = {
  resourceKey: 'fake:things',
  label: 'Things',
  canImport: true,
  canExport: true,
  importFormats: ['csv'],
  exportFormats: ['csv', 'xlsx'],
  fields: [
    { key: 'name', label: '名称', type: 'string', required: true },
    { key: 'password', label: '密码', type: 'string', exportable: false },
    {
      key: 'secret',
      label: '机密',
      type: 'string',
      permissions: { read: 'things:secret:read' },
    },
  ],
}

function makeRun(overrides: Partial<ImportRun> = {}): ImportRun {
  return {
    id: 'run-1',
    organizationId: 'org-1',
    resourceKey: 'fake:things',
    mode: 'partial',
    status: 'queued',
    idempotencyKey: null,
    format: 'csv',
    objectKey: 'org/org-1/bulk/imports/run-1.csv',
    rowCount: 3,
    successCount: 0,
    failureCount: 0,
    mapping: {},
    errors: [],
    options: { format: 'csv', dryRun: false, unknownColumns: 'reject' },
    createdBy: actor.id,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ImportRun
}

function makeService(options: {
  run?: ImportRun
  write?: jest.Mock
  exportsCount?: number
  importsCount?: number
}) {
  const imports = {
    findOne: jest.fn(async () => options.run ?? null),
    find: jest.fn(async () => (options.run ? [options.run] : [])),
    save: jest.fn(async (row: ImportRun) => {
      Object.assign(options.run ?? {}, row)
      return row
    }),
    count: jest.fn(async () => options.importsCount ?? 0),
    create: jest.fn((row: Partial<ImportRun>) => row),
  }
  const exportsRepo = {
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
    save: jest.fn(async (row: ExportRun) => row),
    count: jest.fn(async () => options.exportsCount ?? 0),
    create: jest.fn((row: Partial<ExportRun>) => row),
    createQueryBuilder: jest.fn(),
  }
  const mappings = {
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  }
  const storage = {
    get: jest.fn(async () => Buffer.from('name\nA\nB\n')),
    put: jest.fn(async () => ({})),
    delete: jest.fn(async () => undefined),
    head: jest.fn(async () => null),
    signedUrl: jest.fn(async () => 'https://example.test/file'),
  }
  const assets = {
    get: jest.fn(),
    create: jest.fn(),
    softDelete: jest.fn(),
  }
  const auditLogs = { create: jest.fn(async () => ({})) }
  const jobs = {
    create: jest.fn(async () => ({ job: { id: 'job-1', status: 'queued' }, created: true })),
    cancel: jest.fn(async () => ({})),
  }
  const write =
    options.write ??
    jest.fn(async () => ({ imported: 2, validated: 0, errors: [] }))
  const registry = {
    listResources: jest.fn(async () => [descriptor]),
    describeImport: jest.fn(async () => descriptor),
    describeExport: jest.fn(async () => descriptor),
    importAdapter: jest.fn(() => ({ write })),
    exportAdapter: jest.fn(() => ({
      exportPage: jest.fn(async () => ({ rows: [], total: 0 })),
    })),
  }
  const service = new BulkService(
    registry as unknown as BulkAdapterRegistry,
    imports as never,
    exportsRepo as never,
    mappings as never,
    storage as never,
    assets as never,
    auditLogs as never,
    jobs as never,
  )
  return { service, imports, exportsRepo, storage, jobs, registry, write, auditLogs }
}

describe('BulkService', () => {
  it('幂等键重复提交返回同一运行，不再创建/入队', async () => {
    const existing = makeRun({ idempotencyKey: 'idem-1', options: { jobId: 'job-old' } })
    const ctx = makeService({ run: existing })
    const result = await ctx.service.createImport('org-1', actor, {
      resourceKey: 'fake:things',
      idempotencyKey: 'idem-1',
      file: { buffer: Buffer.from('name\nA\n'), originalName: 'a.csv' },
    })
    expect(result).toMatchObject({ reused: true, jobId: 'job-old' })
    expect(ctx.registry.describeImport).not.toHaveBeenCalled()
    expect(ctx.jobs.create).not.toHaveBeenCalled()
  })

  it('partial：成功行落库、失败行带行号', async () => {
    const run = makeRun()
    const write = jest.fn(async () => ({
      imported: 2,
      validated: 0,
      errors: [{ row: 3, field: 'name', reason: 'required', message: '名称必填' }],
    }))
    const ctx = makeService({ run, write })
    const result = await ctx.service.processImportRun('run-1', 'org-1', actor)
    expect(result.status).toBe('partial')
    expect(result.successCount).toBe(2)
    expect(result.failureCount).toBe(1)
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ resourceKey: 'fake:things' }),
      expect.arrayContaining([expect.objectContaining({ row: 2 })]),
      expect.objectContaining({ mode: 'partial', dryRun: false }),
    )
    expect(ctx.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'data.import', resourceId: 'run-1' }),
    )
  })

  it('atomic：任一行失败整批 0 成功', async () => {
    const run = makeRun({ mode: 'atomic' })
    const write = jest.fn(async () => ({
      imported: 0,
      validated: 0,
      errors: [{ row: 2, reason: 'write-failed', message: '整批回滚' }],
    }))
    const ctx = makeService({ run, write })
    const result = await ctx.service.processImportRun('run-1', 'org-1', actor)
    expect(result.status).toBe('failed')
    expect(result.successCount).toBe(0)
    expect(result.failureCount).toBe(1)
  })

  it('dry-run：只校验不写入', async () => {
    const run = makeRun({ options: { format: 'csv', dryRun: true } })
    const write = jest.fn(async () => ({ imported: 0, validated: 2, errors: [] }))
    const ctx = makeService({ run, write })
    const result = await ctx.service.processImportRun('run-1', 'org-1', actor)
    expect(result.status).toBe('succeeded')
    expect(result.successCount).toBe(2)
    expect(write).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ dryRun: true }),
    )
  })

  it('导出字段权限：默认省略禁止导出字段', async () => {
    const ctx = makeService({})
    const result = await ctx.service.createExport('org-1', actor, {
      resourceKey: 'fake:things',
      format: 'csv',
      fields: ['name', 'password', 'secret'],
    })
    expect(result.run.fields).toEqual(['name'])
    expect(ctx.jobs.create).toHaveBeenCalled()
  })

  it('导出字段权限：reject 策略返回 403', async () => {
    const ctx = makeService({})
    await expect(
      ctx.service.createExport('org-1', actor, {
        resourceKey: 'fake:things',
        format: 'csv',
        fields: ['name', 'password'],
        restrictedFieldPolicy: 'reject',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
