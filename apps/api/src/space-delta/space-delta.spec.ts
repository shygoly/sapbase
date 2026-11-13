import { Validator } from 'jsonschema'
import { loadSchema } from '../common/protocol/schema-loader'
import {
  boundedRepairSpaceDelta,
  detectSpaceDeltaConflicts,
  validateSpaceDelta,
} from './space-delta.validator'

function delta(overrides: Record<string, unknown> = {}) {
  return {
    protocol: 'space-delta/v2',
    baseVersion: 'rev-1',
    operations: [
      {
        op: 'add',
        path: '/semantic/entities',
        value: { name: 'Customer' },
      },
    ],
    ...overrides,
  } as any
}

describe('validateSpaceDelta', () => {
  it('合法声明层 Delta 通过，语义路径为 L2、权限路径为 L3', () => {
    expect(validateSpaceDelta(delta())).toMatchObject({
      valid: true,
      errors: [],
      securityLevel: 'L2',
    })
    expect(
      validateSpaceDelta(
        delta({
          operations: [
            { op: 'update', path: '/permissions/roles/admin', value: {} },
          ],
        }),
      ),
    ).toMatchObject({ valid: true, securityLevel: 'L3' })
    expect(
      validateSpaceDelta(
        delta({
          operations: [{ op: 'add', path: '/ui/pages', value: {} }],
        }),
      ),
    ).toMatchObject({ valid: true, securityLevel: 'L1' })
  })

  it('最终结构路径 /manifest /source /db 拒绝', () => {
    for (const path of ['/manifest/files', '/source/src', '/database/tables']) {
      const result = validateSpaceDelta(
        delta({ operations: [{ op: 'add', path, value: {} }] }),
      )
      expect(result.valid).toBe(false)
      expect(result.errors.join('\n')).toContain('最终结构')
    }
  })

  it('protocol/operations/link 字段校验错误稳定', () => {
    const result = validateSpaceDelta({
      protocol: 'space-delta/v1',
      baseVersion: '',
      operations: [
        { op: 'link', path: '/semantic/relations' },
        { op: 'add', path: '/semantic/entities' },
      ],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      'protocol 必须是 space-delta/v2',
      'baseVersion 必须是非空字符串',
      'operations[0].from 必填',
      'operations[0].to 必填',
      'operations[0].type 必填',
      'operations[1].value 必填',
    ])
  })

  it('schema 文件与运行时校验一致', () => {
    const schema = loadSchema('space-delta.schema.json')
    const validator = new Validator()
    expect(validator.validate(delta(), schema).errors).toEqual([])
    expect(
      validator.validate(
        delta({ operations: [{ op: 'add', path: '/source/file', value: {} }] }),
        schema,
      ).errors.length,
    ).toBeGreaterThan(0)
  })
})

describe('detectSpaceDeltaConflicts', () => {
  it('base version/重复 add/remove-vs-update/link-vs-unlink 稳定排序', () => {
    const conflicts = detectSpaceDeltaConflicts([
      delta({
        baseVersion: 'rev-2',
        operations: [
          { op: 'add', path: '/semantic/entities', value: { name: 'A' } },
          { op: 'add', path: '/semantic/entities', value: { name: 'B' } },
          { op: 'remove', path: '/semantic/fields' },
          { op: 'update', path: '/semantic/fields', value: {} },
          {
            op: 'link',
            path: '/semantic/relations',
            from: 'A',
            to: 'B',
            type: 'belongsTo',
          },
          {
            op: 'unlink',
            path: '/semantic/relations',
            from: 'A',
            to: 'B',
            type: 'belongsTo',
          },
        ],
      }),
      delta({ baseVersion: 'rev-1' }),
    ])
    expect(conflicts.map((conflict) => conflict.code)).toEqual([
      'base-version-mismatch',
      'duplicate-add',
      'remove-vs-mutate',
      'link-vs-unlink',
    ])
    expect(conflicts.map((conflict) => conflict.path)).toEqual([
      '/',
      '/semantic/entities',
      '/semantic/fields',
      '/semantic/relations',
    ])
    expect(conflicts[0].message).toContain('rev-1, rev-2')
  })

  it('无冲突返回空数组', () => {
    expect(detectSpaceDeltaConflicts([delta()])).toEqual([])
  })
})

describe('boundedRepairSpaceDelta', () => {
  it('第 2 次修复成功；不无限重试', async () => {
    const repair = jest
      .fn()
      .mockResolvedValueOnce({ protocol: 'bad', baseVersion: 'rev-1', operations: [] })
      .mockResolvedValueOnce(delta())
    const result = await boundedRepairSpaceDelta({
      delta: { protocol: 'bad' },
      maxAttempts: 3,
      repair,
    })
    expect(result).toMatchObject({ ok: true, attempts: 2 })
    expect(result.history).toHaveLength(2)
    expect(repair).toHaveBeenCalledTimes(2)
  })

  it('修复耗尽返回最后一次错误，attempts 不超过上限', async () => {
    const repair = jest.fn(async () => ({ protocol: 'bad' }))
    const result = await boundedRepairSpaceDelta({
      delta: { protocol: 'bad' },
      maxAttempts: 99,
      repair,
    })
    expect(result.ok).toBe(false)
    expect(result.attempts).toBe(5)
    expect(repair).toHaveBeenCalledTimes(5)
    expect(result.errors[0]).toContain('protocol')
  })
})
