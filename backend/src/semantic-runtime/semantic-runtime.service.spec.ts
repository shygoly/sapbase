/**
 * 写入链的 service 面：装载失败 / 校验失败都不落库；合法写入才 save。
 * 六道字段判据的正负例在 record-validator.spec.ts；这里钉「有没有碰仓库」。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { LoadError } from '../blueprint/loader'
import { packBlueprint } from '../blueprint/packager'
import { RecordWriteError, SemanticRuntimeService } from './semantic-runtime.service'

const TEMPLATE_DIR = resolve(__dirname, '../../../templates/auto-parts-min')

describe('SemanticRuntimeService 落库闸', () => {
  let packagesDir: string
  let save: jest.Mock
  let find: jest.Mock
  let load: jest.Mock
  let query: jest.Mock
  let service: SemanticRuntimeService

  beforeEach(() => {
    packagesDir = mkdtempSync(join(tmpdir(), 'sr-pkgs-'))
    packBlueprint(TEMPLATE_DIR, join(packagesDir, 'auto-parts-min-1.0.0.erpkg'))
    save = jest.fn(async (row: Record<string, unknown>) => ({ id: 'new-id', ...row }))
    find = jest.fn(async () => [])
    query = jest.fn(async () => [])
    load = jest.fn(async () => ({
      manifest: { blueprint: 'auto-parts-min', version: '1.0.0' },
    }))
    const repo = { create: (row: unknown) => row, save, find }
    const manager = { getRepository: () => repo, query }
    service = new SemanticRuntimeService(
      { load, packagesDirectory: () => packagesDir } as never,
      repo as never,
      {
        transaction: async (fn: (m: typeof manager) => unknown) => fn(manager),
        query,
      } as never,
      { create: jest.fn().mockResolvedValue({}) } as never,
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
