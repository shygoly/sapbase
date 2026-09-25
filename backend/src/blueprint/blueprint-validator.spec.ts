// B1 协议冻结的验收：正例通过 + 负例逐类被拒（形状类 + 跨字段一致性类）。
import {
  validateBlueprintIr,
  validateBlueprintPackage,
  validateManifestConsistency,
} from './blueprint-validator'

const SHA = 'a'.repeat(64)

/** 合法 manifest：三个 public 文件 + 一个 configurable 文件，全部被声明。 */
function manifest(overrides: Record<string, unknown> = {}) {
  return {
    blueprint: 'auto-parts-erp',
    version: '2026.1.0',
    runtime: '>=1.0.0 <2.0.0',
    dependencies: [
      { atomic: 'available-inventory', version: '^1.0.0' },
      { module: 'inventory-core', version: '^2.0.0' },
    ],
    layers: {
      public: ['semantic.json', 'forms.json', 'flows.json'],
      configurable: ['config/thresholds.json'],
      protected: [],
    },
    files: {
      'semantic.json': `sha256:${SHA}`,
      'forms.json': `sha256:${SHA}`,
      'flows.json': `sha256:${SHA}`,
      'config/thresholds.json': `sha256:${SHA}`,
    },
    license: { required: true, server: null },
    ...overrides,
  }
}

describe('validateBlueprintPackage（形状 + 一致性）', () => {
  it('接受合法 manifest', () => {
    const result = validateBlueprintPackage(manifest())
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it.each([
    ['缺 version', manifest({ version: undefined }), 'version'],
    ['version 非语义化版本', manifest({ version: 'v1' }), 'version'],
    ['blueprint id 非 kebab-case', manifest({ blueprint: 'AutoParts' }), 'blueprint'],
    ['runtime 为空', manifest({ runtime: '' }), 'runtime'],
    ['files 哈希格式非法', manifest({ files: { 'semantic.json': 'sha256:zzz' } }), 'files'],
    ['files 为空', manifest({ files: {} }), 'files'],
    ['依赖格式非法（缺 version）', manifest({ dependencies: [{ atomic: 'x' }] }), 'dependencies'],
    ['依赖类型非法（既不是 atomic/module/blueprint）', manifest({ dependencies: [{ thing: 'x', version: '1' }] }), 'dependencies'],
    ['分层缺失 public', manifest({ layers: { configurable: [] } }), 'layers'],
    ['出现未声明字段', manifest({ extra: true }), 'extra'],
  ])('拒绝形状违约：%s', (_label, value, expectedPath) => {
    const result = validateBlueprintPackage(value)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' | ')).toContain(expectedPath)
  })

  it.each([
    [
      '分层引用了 files 里不存在的文件',
      {
        layers: { public: ['a.json', 'ghost.json'] },
        files: { 'a.json': `sha256:${SHA}` },
      },
      'ghost.json',
    ],
    [
      'files 里有文件未被任何层覆盖',
      {
        layers: { public: ['a.json'] },
        files: { 'a.json': `sha256:${SHA}`, 'b.json': `sha256:${SHA}` },
      },
      '未被任何层覆盖',
    ],
    [
      '同一文件出现在多层',
      {
        layers: { public: ['a.json'], protected: ['a.json'] },
        files: { 'a.json': `sha256:${SHA}` },
      },
      '同时出现在多层',
    ],
  ])('拒绝一致性违约：%s', (_label, value, expected) => {
    const result = validateManifestConsistency(value)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' | ')).toContain(expected)
  })

  it('拒绝路径穿越（filePath 模式）', () => {
    const result = validateBlueprintPackage(
      manifest({
        files: { '../../etc/passwd': `sha256:${SHA}` },
        layers: { public: ['../../etc/passwd'] },
      }),
    )
    expect(result.valid).toBe(false)
  })
})

describe('validateBlueprintIr', () => {
  const ir = {
    ir: 'blueprint-ir/v1',
    blueprint: 'auto-parts-erp',
    version: '2026.1.0',
    entities: [{ name: 'SalesOrder', fieldCount: 6, states: ['draft', 'submitted'] }],
    events: [
      {
        on: 'SalesOrder.submitted',
        actions: [
          { kind: 'check', atomic: 'available-inventory@^1.0.0' },
          { kind: 'require-approval', rule: 'PURCHASE_HIGH_VALUE', when: 'total > 100000' },
          { kind: 'post-accounting', entry: 'SALES_INVOICE_POSTED' },
        ],
      },
    ],
    dependencies: ['available-inventory@1.0.0'],
    summary: { entities: 1, events: 1, files: 4 },
  }

  it('接受合法结构化 IR', () => {
    expect(validateBlueprintIr(ir).errors).toEqual([])
  })

  it.each([
    ['ir 版本标识错误', { ...ir, ir: 'blueprint-ir/v2' }, 'ir'],
    ['事件名格式非法', { ...ir, events: [{ on: 'bad', actions: [{ kind: 'check', atomic: 'a@1' }] }] }, 'on'],
    ['check 动作缺 atomic', { ...ir, events: [{ on: 'SalesOrder.submitted', actions: [{ kind: 'check' }] }] }, 'atomic'],
    ['require-approval 缺 rule', { ...ir, events: [{ on: 'SalesOrder.submitted', actions: [{ kind: 'require-approval' }] }] }, 'rule'],
    ['动作类型非法', { ...ir, events: [{ on: 'SalesOrder.submitted', actions: [{ kind: 'do-magic' }] }] }, 'kind'],
    ['实体无状态（states 缺省）', { ...ir, entities: [{ name: 'SalesOrder', fieldCount: 1 }] }, 'states'],
  ])('拒绝 IR 违约：%s', (_label, value, expectedPath) => {
    const result = validateBlueprintIr(value)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' | ')).toContain(expectedPath)
  })
})
