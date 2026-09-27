/**
 * 写入链的 service 面：装载失败 / 校验失败都不落库；合法写入才 save。
 * 六道字段判据的正负例在 record-validator.spec.ts；这里钉「有没有碰仓库」。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { LoadError } from '../blueprint/loader'
import { packBlueprint } from '../blueprint/packager'
import { collectLogsAsync } from '../common/logging/structured-logger'
import {
  projectSemanticDeclaration,
  RecordWriteError,
  SemanticRuntimeService,
} from './semantic-runtime.service'
import { NotFoundException } from '@nestjs/common'

const TEMPLATE_DIR = resolve(__dirname, '../../../templates/auto-parts-min')

describe('SemanticRuntimeService 落库闸', () => {
  let packagesDir: string
  let save: jest.Mock
  let find: jest.Mock
  let findOne: jest.Mock
  let load: jest.Mock
  let query: jest.Mock
  let service: SemanticRuntimeService

  beforeEach(() => {
    packagesDir = mkdtempSync(join(tmpdir(), 'sr-pkgs-'))
    packBlueprint(TEMPLATE_DIR, join(packagesDir, 'auto-parts-min-1.0.0.erpkg'))
    save = jest.fn(async (row: Record<string, unknown>) => ({ id: 'new-id', ...row }))
    find = jest.fn(async () => [])
    findOne = jest.fn(async () => null)
    query = jest.fn(async () => [])
    load = jest.fn(async () => ({
      manifest: { blueprint: 'auto-parts-min', version: '1.0.0' },
    }))
    const repo = { create: (row: unknown) => row, save, find, findOne }
    const manager = { getRepository: () => repo, query }
    service = new SemanticRuntimeService(
      { load, packagesDirectory: () => packagesDir } as never,
      repo as never,
      {
        transaction: async (fn: (m: typeof manager) => unknown) => fn(manager),
        query,
      } as never,
      { create: jest.fn().mockResolvedValue({}) } as never,
      { publish: jest.fn().mockResolvedValue({}) } as never,
    )
  })

  afterEach(() => {
    rmSync(packagesDir, { recursive: true, force: true })
  })

  it('装载失败 → 不落库', async () => {
    load.mockRejectedValue(new LoadError('未授权', 'unauthorized'))
    await expect(
      service.write('auto-parts-min-1.0.0', 'Part', { partNo: 'P-1' }, 'org-b'),
    ).rejects.toMatchObject({ reason: 'unauthorized' })
    expect(save).not.toHaveBeenCalled()
  })

  it('未知字段 → 不落库', async () => {
    await expect(
      service.write('auto-parts-min-1.0.0', 'Part', { partNo: 'P-1', ghost: true }, 'org-b'),
    ).rejects.toBeInstanceOf(RecordWriteError)
    await expect(
      service.write('auto-parts-min-1.0.0', 'Part', { partNo: 'P-1', ghost: true }, 'org-b'),
    ).rejects.toMatchObject({ reason: 'unknown-field' })
    expect(save).not.toHaveBeenCalled()
  })

  it('违反 validation（缺 partNo / quantity=0）→ 不落库', async () => {
    await expect(
      service.write('auto-parts-min-1.0.0', 'Part', { name: '垫片' }, 'org-b'),
    ).rejects.toMatchObject({ reason: 'validation-failed', ruleId: 'part-no-required' })
    expect(save).not.toHaveBeenCalled()

    find.mockResolvedValue([{ id: 'c1', entity: 'Customer' }, { id: 'p1', entity: 'Part' }])
    await expect(
      service.write(
        'auto-parts-min-1.0.0',
        'SalesOrder',
        { quantity: 0, unitPrice: 10, customer: 'c1', part: 'p1' },
        'org-b',
      ),
    ).rejects.toMatchObject({ reason: 'validation-failed', ruleId: 'so-qty-positive' })
    expect(save).not.toHaveBeenCalled()
  })

  it('合法 Part 写入 → save 一次且带租户', async () => {
    const saved = await service.write(
      'auto-parts-min-1.0.0',
      'Part',
      { partNo: 'P-1', name: '垫片' },
      'org-b',
    )
    expect(save).toHaveBeenCalledTimes(1)
    expect(saved).toMatchObject({
      id: 'new-id',
      blueprintId: 'auto-parts-min',
      blueprintVersion: '1.0.0',
      entity: 'Part',
      organizationId: 'org-b',
      data: { partNo: 'P-1', name: '垫片' },
    })
  })
})

describe('projectSemanticDeclaration', () => {
  it('只投影 name / children / states / transitions，不带字段', () => {
    const projected = projectSemanticDeclaration([
      {
        name: 'SalesOrder',
        children: ['SalesOrderLine'],
        states: [
          { name: 'draft', initial: true },
          { name: 'closed', final: true },
        ],
        transitions: [{ from: 'draft', to: 'closed' }],
        fields: [{ name: 'secret' }],
      } as never,
    ])
    expect(projected).toEqual({
      entities: [
        {
          name: 'SalesOrder',
          children: ['SalesOrderLine'],
          states: [
            { name: 'draft', initial: true, final: false },
            { name: 'closed', initial: false, final: true },
          ],
          transitions: [{ from: 'draft', to: 'closed' }],
        },
      ],
    })
    expect(JSON.stringify(projected)).not.toContain('secret')
    expect(JSON.stringify(projected)).not.toContain('fields')
  })
})

describe('SemanticRuntimeService 只读接口', () => {
  let packagesDir: string
  let save: jest.Mock
  let findOne: jest.Mock
  let load: jest.Mock
  let service: SemanticRuntimeService

  beforeEach(() => {
    packagesDir = mkdtempSync(join(tmpdir(), 'sr-read-'))
    packBlueprint(TEMPLATE_DIR, join(packagesDir, 'auto-parts-min-1.0.0.erpkg'))
    save = jest.fn()
    findOne = jest.fn(async () => null)
    load = jest.fn(async () => ({
      manifest: { blueprint: 'auto-parts-min', version: '1.0.0' },
    }))
    const repo = { create: (row: unknown) => row, save, find: jest.fn(), findOne }
    const manager = { getRepository: () => repo, query: jest.fn() }
    service = new SemanticRuntimeService(
      { load, packagesDirectory: () => packagesDir } as never,
      repo as never,
      {
        transaction: async (fn: (m: typeof manager) => unknown) => fn(manager),
        query: jest.fn(),
      } as never,
      { create: jest.fn().mockResolvedValue({}) } as never,
      { publish: jest.fn().mockResolvedValue({}) } as never,
    )
  })

  afterEach(() => {
    rmSync(packagesDir, { recursive: true, force: true })
  })

  it('semantic：走授权门，不写库，不带字段', async () => {
    const declared = await service.semantic('auto-parts-min-1.0.0', 'org-b')
    expect(load).toHaveBeenCalledWith('auto-parts-min-1.0.0', { tenantId: 'org-b' })
    expect(save).not.toHaveBeenCalled()
    const sales = declared.entities.find((item) => item.name === 'SalesOrder')
    expect(sales?.states.some((state) => state.name === 'draft' && state.initial)).toBe(true)
    expect(sales?.transitions).toEqual(expect.arrayContaining([{ from: 'draft', to: 'confirmed' }]))
    expect(JSON.stringify(declared)).not.toContain('fields')
  })

  it('read：他租 / 找不到 → 404；命中则走 withResolvedState', async () => {
    await expect(
      service.read('auto-parts-min-1.0.0', 'SalesOrder', 'missing', 'org-b'),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(findOne).toHaveBeenCalledWith({
      where: {
        id: 'missing',
        entity: 'SalesOrder',
        blueprintId: 'auto-parts-min',
        organizationId: 'org-b',
      },
    })

    findOne.mockResolvedValue({
      id: 'rec-1',
      entity: 'SalesOrder',
      organizationId: 'org-b',
      state: null,
      data: { quantity: 1 },
    })
    const row = await service.read('auto-parts-min-1.0.0', 'SalesOrder', 'rec-1', 'org-b')
    expect(row.state).toBe('draft')
    expect(row).toMatchObject({ omittedFields: [] })
    expect(save).not.toHaveBeenCalled()
  })
})

describe('SemanticRuntimeService 结构化日志（N3）', () => {
  let packagesDir: string
  let service: SemanticRuntimeService
  let findOne: jest.Mock
  let findOneByOrFail: jest.Mock
  const previousFormat = process.env.LOG_FORMAT

  beforeEach(() => {
    packagesDir = mkdtempSync(join(tmpdir(), 'sr-log-'))
    packBlueprint(TEMPLATE_DIR, join(packagesDir, 'auto-parts-min-1.0.0.erpkg'))
    process.env.LOG_FORMAT = 'json'
    findOne = jest.fn()
    findOneByOrFail = jest.fn()
    const qb = {
      update() {
        return this
      },
      set() {
        return this
      },
      where() {
        return this
      },
      andWhere() {
        return this
      },
      execute: jest.fn(async () => ({ affected: 1 })),
    }
    const repo = {
      create: (row: unknown) => row,
      save: jest.fn(async (row: unknown) => row),
      find: jest.fn(async () => []),
      findOne,
      findOneByOrFail,
      createQueryBuilder: () => qb,
    }
    const manager = { getRepository: () => repo, query: jest.fn(async () => []) }
    service = new SemanticRuntimeService(
      {
        load: jest.fn(async () => ({ manifest: { blueprint: 'auto-parts-min', version: '1.0.0' } })),
        packagesDirectory: () => packagesDir,
      } as never,
      repo as never,
      {
        transaction: async (fn: (m: typeof manager) => unknown) => fn(manager),
        query: jest.fn(async () => []),
      } as never,
      { create: jest.fn().mockResolvedValue({}) } as never,
      { publish: jest.fn().mockResolvedValue({}) } as never,
    )
  })

  afterEach(() => {
    rmSync(packagesDir, { recursive: true, force: true })
    if (previousFormat === undefined) delete process.env.LOG_FORMAT
    else process.env.LOG_FORMAT = previousFormat
  })

  it('importMaster 打出 imported/failed/dryRun，不含行 data', async () => {
    const lines = await collectLogsAsync(async () => {
      await service.importMaster('auto-parts-min-1.0.0', 'Part', { rows: [] }, 'org-b')
    })
    const parsed = JSON.parse(lines.find((line) => line.includes('"importMaster"')) ?? '{}')
    expect(parsed).toEqual(
      expect.objectContaining({ msg: 'importMaster', entity: 'Part', imported: 0, failed: 0, dryRun: false }),
    )
    expect(parsed.data).toBeUndefined()
  })

  it('transition 打出 blueprintId/entity/recordId/from/to/version，不含 data', async () => {
    findOne.mockResolvedValue({
      id: 'r1',
      entity: 'Part',
      state: 'active',
      version: 1,
      blueprintId: 'auto-parts-min',
      organizationId: 'org-b',
      data: { partNo: 'P-1', name: 'secret-part' },
    })
    findOneByOrFail.mockResolvedValue({
      id: 'r1',
      entity: 'Part',
      state: 'obsolete',
      version: 2,
      data: { partNo: 'P-1', name: 'secret-part' },
    })
    const lines = await collectLogsAsync(async () => {
      await service.transition('auto-parts-min-1.0.0', 'Part', 'r1', { to: 'obsolete' }, 'org-b')
    })
    const parsed = JSON.parse(lines.find((line) => line.includes('"transition"')) ?? '{}')
    expect(parsed).toEqual(
      expect.objectContaining({
        msg: 'transition',
        blueprintId: 'auto-parts-min',
        entity: 'Part',
        recordId: 'r1',
        from: 'active',
        to: 'obsolete',
        version: 2,
      }),
    )
    expect(JSON.stringify(parsed)).not.toContain('secret-part')
    expect(parsed.data).toBeUndefined()
  })

  it('approve 打出 ruleId/stepIndex/role/result', async () => {
    findOne.mockResolvedValue(null)
    const pending = {
      stepIndex: 0,
      role: 'owner',
      status: 'pending' as const,
      actor: null,
      decidedAt: undefined,
    }
    const repo = {
      create: (row: unknown) => row,
      save: jest.fn(async (row: unknown) => row),
      find: jest.fn(async () => [pending]),
      findOne,
      findOneByOrFail,
    }
    const manager = { getRepository: () => repo, query: jest.fn(async () => []) }
    service = new SemanticRuntimeService(
      {
        load: jest.fn(async () => ({ manifest: { blueprint: 'auto-parts-min', version: '1.0.0' } })),
        packagesDirectory: () => packagesDir,
      } as never,
      repo as never,
      {
        transaction: async (fn: (m: typeof manager) => unknown) => fn(manager),
        query: jest.fn(async () => []),
      } as never,
      { create: jest.fn().mockResolvedValue({}) } as never,
      { publish: jest.fn().mockResolvedValue({}) } as never,
    )
    const lines = await collectLogsAsync(async () => {
      await service.approve(
        'auto-parts-min-1.0.0',
        'SalesOrder',
        'r1',
        'so-large-quantity',
        'owner',
        'org-b',
        'approver-1',
      )
    })
    const parsed = JSON.parse(lines.find((line) => line.includes('"approve"')) ?? '{}')
    expect(parsed).toEqual(
      expect.objectContaining({
        msg: 'approve',
        ruleId: 'so-large-quantity',
        stepIndex: 0,
        role: 'owner',
      }),
    )
  })
})
